// Order lifecycle: create → receipt upload → instant provision (clean) or hold
// (flagged) → admin verify / revoke.
import { db, tables } from "@/db";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { randomBytes, randomInt } from "crypto";
import { getXui, gbToBytes, buildSubUrl, buildVlessLink } from "@/lib/xui";
import { getSetting, getSettingInt, SETTING_KEYS } from "@/lib/settings";

const OPEN_STATUSES = ["pending_payment", "held", "approved"] as const;

export function genPublicId(): string {
  return randomBytes(4).toString("hex"); // 8 chars, shown to the user
}

/**
 * Amount = base price + unique 1..999 Toman suffix, unique among open orders.
 * Makes every pending order's expected transfer amount unambiguous.
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

export function createOrder(userId: number, planId: number) {
  const plan = db.select().from(tables.plans).where(eq(tables.plans.id, planId)).get();
  if (!plan || !plan.active) throw new Error("پلن مورد نظر یافت نشد");

  // cap concurrent open orders per user
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
      planId,
      planName: plan.name,
      days: plan.days,
      gb: plan.gb,
      limitIp: plan.limitIp,
      basePriceToman: plan.priceToman,
      amountToman: pickUniqueAmount(plan.priceToman),
      inboundId: plan.inboundId,
    })
    .returning()
    .get();
  return order;
}

/** Auto-flag checks run at receipt submission. Returns list of flag reasons. */
export function computeReceiptFlags(userId: number, imageHash: string, trackingCode?: string | null): string[] {
  const flags: string[] = [];

  const dupe = db
    .select({ id: tables.receipts.id, orderId: tables.receipts.orderId })
    .from(tables.receipts)
    .where(eq(tables.receipts.imageHash, imageHash))
    .get();
  if (dupe) flags.push(`تصویر تکراری (رسید سفارش #${dupe.orderId})`);

  if (trackingCode) {
    const tcDupe = db
      .select({ orderId: tables.receipts.orderId })
      .from(tables.receipts)
      .where(eq(tables.receipts.trackingCode, trackingCode))
      .get();
    if (tcDupe) flags.push(`کد پیگیری تکراری (سفارش #${tcDupe.orderId})`);
  }

  const rejected = db
    .select({ n: sql<number>`count(*)` })
    .from(tables.receipts)
    .where(and(eq(tables.receipts.userId, userId), eq(tables.receipts.reviewStatus, "fake")))
    .get();
  if ((rejected?.n ?? 0) > 0) flags.push("کاربر سابقه رسید جعلی دارد");

  return flags;
}

export interface DeliveredConfig {
  subUrl: string;
  vlessLink: string | null;
  expiresAt: number;
}

/**
 * Provision the order's client on the 3x-ui panel and mark it approved.
 * Called for clean receipts (instant) or from admin approval of held orders.
 */
export async function provisionOrder(orderId: number): Promise<DeliveredConfig> {
  const order = db.select().from(tables.orders).where(eq(tables.orders.id, orderId)).get();
  if (!order) throw new Error("سفارش یافت نشد");
  if (order.provisionedAt) {
    // already provisioned (idempotency)
    return deliveredConfigFor(order.id);
  }
  if (!order.inboundId) throw new Error("اینباند سفارش نامشخص است");

  const xui = getXui();
  const email = `ord_${order.publicId}`;
  const expiresAt = Date.now() + order.days * 86_400_000;
  const { uuid, subId } = await xui.addClient(order.inboundId, {
    email,
    totalGB: gbToBytes(order.gb),
    expiryTime: expiresAt,
    limitIp: order.limitIp,
    comment: `site order ${order.publicId}`,
  });

  db.update(tables.orders)
    .set({
      status: "approved",
      xuiEmail: email,
      xuiUuid: uuid,
      subId,
      provisionedAt: Date.now(),
      expiresAt,
    })
    .where(eq(tables.orders.id, orderId))
    .run();

  return deliveredConfigFor(orderId);
}

/** Build the deliverables (sub URL + optional vless link) for a provisioned order. */
export async function deliveredConfigFor(orderId: number): Promise<DeliveredConfig> {
  const order = db.select().from(tables.orders).where(eq(tables.orders.id, orderId)).get();
  if (!order?.subId || !order.xuiUuid || !order.inboundId) throw new Error("سفارش هنوز فعال نشده");

  const subBase = getSetting(SETTING_KEYS.subBase);
  const subUrl = subBase ? buildSubUrl(subBase, order.subId) : "";

  let vlessLink: string | null = null;
  const publicHost = getSetting(SETTING_KEYS.publicHost);
  if (publicHost) {
    try {
      const inbound = await getXui().getInbound(order.inboundId);
      if (inbound.protocol === "vless") {
        vlessLink = buildVlessLink(inbound, order.xuiUuid, order.xuiEmail!, publicHost);
      }
    } catch {
      // link building is best-effort; sub URL is the primary deliverable
    }
  }
  return { subUrl, vlessLink, expiresAt: order.expiresAt! };
}

/** Admin: revoke an approved order (fake receipt) — disables the client, reversible. */
export async function revokeOrder(orderId: number, adminId: number, reason: string): Promise<void> {
  const order = db.select().from(tables.orders).where(eq(tables.orders.id, orderId)).get();
  if (!order) throw new Error("سفارش یافت نشد");
  if (order.xuiUuid && order.inboundId) {
    await getXui().setClientEnable(order.inboundId, order.xuiUuid, false);
  }
  db.update(tables.orders)
    .set({ status: "revoked", revokeReason: reason })
    .where(eq(tables.orders.id, orderId))
    .run();
  db.insert(tables.auditLog)
    .values({ actorId: adminId, action: "order.revoke", target: `order:${orderId}`, detail: reason })
    .run();
}

/** Admin: un-revoke (dispute resolved) — re-enables the client. */
export async function unrevokeOrder(orderId: number, adminId: number): Promise<void> {
  const order = db.select().from(tables.orders).where(eq(tables.orders.id, orderId)).get();
  if (!order) throw new Error("سفارش یافت نشد");
  if (order.xuiUuid && order.inboundId) {
    await getXui().setClientEnable(order.inboundId, order.xuiUuid, true);
  }
  db.update(tables.orders)
    .set({ status: "verified", revokeReason: null })
    .where(eq(tables.orders.id, orderId))
    .run();
  db.insert(tables.auditLog)
    .values({ actorId: adminId, action: "order.unrevoke", target: `order:${orderId}` })
    .run();
}
