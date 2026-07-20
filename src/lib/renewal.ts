// Renewal flow: a renewal is a NEW order that copies the plan snapshot
// (days/gb/limitIp/basePriceToman) of an existing approved/verified/expired
// order at the same price. Payment + receipt + provisioning then run through
// the normal purchase pipeline, so the user receives a fresh config with the
// same specs (v1 semantics: renewal = fresh config; the original config keeps
// working until it expires).
//
// The link back to the original order is stored in the settings key/value
// table (key `renewal:<newPublicId>` → original order id) — no schema change.
import { db, tables } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomInt } from "crypto";
import { genPublicId } from "@/lib/orders";
import { getSetting, getSettingInt, setSetting, SETTING_KEYS } from "@/lib/settings";

const OPEN_STATUSES = ["pending_payment", "held", "approved"] as const;

/** Statuses whose orders may be renewed (same specs, same price). */
const RENEWABLE_STATUSES = new Set<string>(["approved", "verified", "expired"]);

export function isRenewable(status: string): boolean {
  return RENEWABLE_STATUSES.has(status);
}

/**
 * Amount = base price + unique 1..999 Toman suffix, unique among open orders.
 * Mirrors the picker in orders.ts (kept private there).
 */
function pickUniqueAmount(basePriceToman: number): number {
  const open = db
    .select({ amount: tables.orders.amountToman })
    .from(tables.orders)
    .where(inArray(tables.orders.status, [...OPEN_STATUSES]))
    .all();
  const used = new Set(open.map((o) => o.amount));
  for (let i = 0; i < 50; i++) {
    const candidate = basePriceToman + randomInt(1, 1000);
    if (!used.has(candidate)) return candidate;
  }
  return basePriceToman + randomInt(1, 1000); // collision acceptable fallback
}

/**
 * Create a renewal order for the given original order: a fresh pending_payment
 * order with the SAME plan snapshot and base price. Returns the new order row.
 */
export function createRenewalOrder(userId: number, originalOrderId: number) {
  const original = db
    .select()
    .from(tables.orders)
    .where(eq(tables.orders.id, originalOrderId))
    .get();
  if (!original || original.userId !== userId) throw new Error("سفارش یافت نشد");
  if (!isRenewable(original.status)) throw new Error("این سفارش قابل تمدید نیست");

  // inbound to provision on: snapshot from the original, else the plan's current one
  const inboundId =
    original.inboundId ??
    db
      .select({ inboundId: tables.plans.inboundId })
      .from(tables.plans)
      .where(eq(tables.plans.id, original.planId))
      .get()?.inboundId;
  if (!inboundId) throw new Error("اینباند این سرویس نامشخص است؛ با پشتیبانی تماس بگیرید");

  // cap concurrent open orders per user (same rule as a normal purchase)
  const maxPending = getSettingInt(SETTING_KEYS.maxPendingOrders, 2);
  const openCount = db
    .select({ n: sql<number>`count(*)` })
    .from(tables.orders)
    .where(
      and(eq(tables.orders.userId, userId), inArray(tables.orders.status, ["pending_payment", "held"])),
    )
    .get();
  if ((openCount?.n ?? 0) >= maxPending) {
    throw new Error("شما چند سفارش در انتظار پرداخت دارید؛ ابتدا آن‌ها را تکمیل کنید");
  }

  const publicId = genPublicId();
  const order = db
    .insert(tables.orders)
    .values({
      publicId,
      userId,
      planId: original.planId,
      planName: original.planName,
      days: original.days,
      gb: original.gb,
      limitIp: original.limitIp,
      basePriceToman: original.basePriceToman,
      amountToman: pickUniqueAmount(original.basePriceToman),
      inboundId,
    })
    .returning()
    .get();

  // side-table marker: renewal:<newPublicId> → original order id
  setSetting(`renewal:${order.publicId}`, String(original.id));

  return order;
}

/** Original order id for a renewal order's publicId, or null if not a renewal. */
export function getRenewalOriginalOrderId(newPublicId: string): number | null {
  const v = getSetting(`renewal:${newPublicId}`);
  const id = parseInt(v, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}
