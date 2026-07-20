import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { and, eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { storeReceipt } from "@/lib/receipts";
import { computeReceiptFlags, provisionOrder } from "@/lib/orders";
import { getSettingInt, SETTING_KEYS } from "@/lib/settings";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/orders/[publicId]/receipt">) {
  const user = await currentUser();
  if (!user || user.banned) {
    return NextResponse.json({ error: "ابتدا وارد حساب خود شوید" }, { status: 401 });
  }
  const { publicId } = await ctx.params;

  const order = db
    .select()
    .from(tables.orders)
    .where(and(eq(tables.orders.publicId, publicId), eq(tables.orders.userId, user.id)))
    .get();
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  if (order.status !== "pending_payment") {
    return NextResponse.json({ error: "برای این سفارش قبلاً رسید ثبت شده است" }, { status: 409 });
  }

  // payment window check
  const windowMin = getSettingInt(SETTING_KEYS.paymentWindowMin, 45);
  if (Date.now() - order.createdAt > windowMin * 60_000) {
    db.update(tables.orders).set({ status: "expired" }).where(eq(tables.orders.id, order.id)).run();
    return NextResponse.json(
      { error: "مهلت پرداخت این سفارش تمام شده؛ لطفاً سفارش جدیدی ثبت کنید" },
      { status: 410 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "تصویر رسید را انتخاب کنید" }, { status: 400 });
  }
  const trackingCode = String(form?.get("trackingCode") ?? "").trim().slice(0, 40) || null;
  const payerCardLast4 = String(form?.get("payerCardLast4") ?? "").trim().slice(0, 4) || null;

  let stored;
  try {
    stored = await storeReceipt(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const flags = computeReceiptFlags(user.id, stored.hash, trackingCode);

  db.insert(tables.receipts)
    .values({
      orderId: order.id,
      userId: user.id,
      imagePath: stored.relPath,
      imageHash: stored.hash,
      trackingCode,
      payerCardLast4,
      flags: flags.length ? JSON.stringify(flags) : null,
    })
    .run();

  if (flags.length > 0) {
    // suspicious → hold for manual review, no instant delivery
    db.update(tables.orders).set({ status: "held" }).where(eq(tables.orders.id, order.id)).run();
    return NextResponse.json({
      ok: true,
      held: true,
      message: "رسید شما ثبت شد و پس از بررسی مدیر، سرویس فعال می‌شود",
    });
  }

  // clean receipt → provision instantly
  try {
    await provisionOrder(order.id);
  } catch (e) {
    // panel failure: hold the order so admin can retry, don't lose the receipt
    db.update(tables.orders).set({ status: "held" }).where(eq(tables.orders.id, order.id)).run();
    console.error("provision failed:", e);
    return NextResponse.json({
      ok: true,
      held: true,
      message: "رسید ثبت شد؛ فعال‌سازی خودکار با خطا مواجه شد و به‌زودی توسط مدیر انجام می‌شود",
    });
  }

  return NextResponse.json({ ok: true, held: false });
}
