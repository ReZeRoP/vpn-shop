import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { and, eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { createRenewalOrder } from "@/lib/renewal";

/** Create a renewal order (same plan snapshot, same price) for one of the user's orders. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/orders/[publicId]/renew">) {
  const user = await currentUser();
  if (!user || user.banned) {
    return NextResponse.json({ error: "ابتدا وارد حساب خود شوید" }, { status: 401 });
  }
  const { publicId } = await ctx.params;

  const original = db
    .select({ id: tables.orders.id })
    .from(tables.orders)
    .where(and(eq(tables.orders.publicId, publicId), eq(tables.orders.userId, user.id)))
    .get();
  if (!original) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  try {
    const order = createRenewalOrder(user.id, original.id);
    return NextResponse.json({ ok: true, publicId: order.publicId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
