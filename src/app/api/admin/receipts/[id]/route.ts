import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { and, eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { provisionOrder, revokeOrder } from "@/lib/orders";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/receipts/[id]">) {
  const admin = await currentUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const receiptId = Number(id);
  const { action, mode, reason } = await req.json().catch(() => ({}));

  const receipt = db.select().from(tables.receipts).where(eq(tables.receipts.id, receiptId)).get();
  if (!receipt) return NextResponse.json({ error: "رسید یافت نشد" }, { status: 404 });

  const order = db.select().from(tables.orders).where(eq(tables.orders.id, receipt.orderId)).get();
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  if (action === "approve") {
    // idempotency: only act if still pending
    const updated = db
      .update(tables.receipts)
      .set({ reviewStatus: "ok", reviewedBy: admin.id, reviewedAt: Date.now() })
      .where(and(eq(tables.receipts.id, receiptId), eq(tables.receipts.reviewStatus, "pending")))
      .run();
    if (updated.changes === 0) {
      return NextResponse.json({ error: "این رسید قبلاً بررسی شده است" }, { status: 409 });
    }

    // held orders were never provisioned — provision now
    if (!order.provisionedAt) {
      try {
        await provisionOrder(order.id);
      } catch (e) {
        // roll back review status so admin can retry
        db.update(tables.receipts)
          .set({ reviewStatus: "pending", reviewedBy: null, reviewedAt: null })
          .where(eq(tables.receipts.id, receiptId))
          .run();
        return NextResponse.json(
          { error: `فعال‌سازی روی پنل ناموفق: ${(e as Error).message}` },
          { status: 502 },
        );
      }
    }
    db.update(tables.orders).set({ status: "verified" }).where(eq(tables.orders.id, order.id)).run();
    db.update(tables.users)
      .set({ verifiedBuyer: true })
      .where(eq(tables.users.id, order.userId))
      .run();
    db.insert(tables.auditLog)
      .values({ actorId: admin.id, action: "receipt.approve", target: `order:${order.id}` })
      .run();
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    const reviewStatus = mode === "revoke" ? "fake" : "resubmit";
    const updated = db
      .update(tables.receipts)
      .set({
        reviewStatus,
        reviewedBy: admin.id,
        reviewedAt: Date.now(),
        reviewNote: String(reason ?? "").slice(0, 300),
      })
      .where(and(eq(tables.receipts.id, receiptId), eq(tables.receipts.reviewStatus, "pending")))
      .run();
    if (updated.changes === 0) {
      return NextResponse.json({ error: "این رسید قبلاً بررسی شده است" }, { status: 409 });
    }

    if (mode === "revoke") {
      try {
        await revokeOrder(order.id, admin.id, String(reason ?? "رسید نامعتبر"));
      } catch (e) {
        return NextResponse.json(
          {
            error: `رسید رد شد اما غیرفعال‌سازی روی پنل ناموفق بود — دوباره تلاش کنید: ${(e as Error).message}`,
          },
          { status: 502 },
        );
      }
    } else {
      // resubmit: put order back so user can upload a new receipt
      db.update(tables.orders)
        .set({ status: "pending_payment" })
        .where(eq(tables.orders.id, order.id))
        .run();
      db.insert(tables.auditLog)
        .values({
          actorId: admin.id,
          action: "receipt.resubmit",
          target: `order:${order.id}`,
          detail: String(reason ?? ""),
        })
        .run();
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
}
