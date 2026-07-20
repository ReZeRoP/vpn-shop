import { db, tables } from "@/db";
import { eq, desc, sql } from "drizzle-orm";
import { toman, jalaliDateTime, faInt } from "@/lib/format";
import ReceiptReviewCard from "@/components/admin/ReceiptReviewCard";

export const metadata = { title: "صف بررسی رسیدها" };
export const dynamic = "force-dynamic";

export default function AdminReceiptsPage() {
  const pending = db
    .select({
      receipt: tables.receipts,
      order: tables.orders,
      username: tables.users.username,
    })
    .from(tables.receipts)
    .innerJoin(tables.orders, eq(tables.receipts.orderId, tables.orders.id))
    .innerJoin(tables.users, eq(tables.receipts.userId, tables.users.id))
    .where(eq(tables.receipts.reviewStatus, "pending"))
    .orderBy(desc(tables.receipts.createdAt))
    .all();

  // per-user purchase history for context
  const stats = db
    .select({
      userId: tables.orders.userId,
      verified: sql<number>`sum(case when status = 'verified' then 1 else 0 end)`,
      revoked: sql<number>`sum(case when status = 'revoked' then 1 else 0 end)`,
    })
    .from(tables.orders)
    .groupBy(tables.orders.userId)
    .all();
  const statMap = new Map(stats.map((s) => [s.userId, s]));

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">
        صف بررسی رسیدها {pending.length > 0 && <span className="text-warn">({faInt(pending.length)})</span>}
      </h1>
      {pending.length === 0 ? (
        <p className="rounded-card border border-line bg-panel p-10 text-center text-muted">
          🎉 هیچ رسیدی در انتظار بررسی نیست
        </p>
      ) : (
        <div className="space-y-4">
          {pending.map(({ receipt, order, username }) => {
            const s = statMap.get(order.userId);
            return (
              <ReceiptReviewCard
                key={receipt.id}
                receiptId={receipt.id}
                orderPublicId={order.publicId}
                orderStatus={order.status}
                username={username}
                planName={order.planName}
                amountLabel={toman(order.amountToman)}
                submittedLabel={jalaliDateTime(receipt.createdAt)}
                trackingCode={receipt.trackingCode}
                payerCardLast4={receipt.payerCardLast4}
                flags={receipt.flags ? (JSON.parse(receipt.flags) as string[]) : []}
                userVerifiedCount={s?.verified ?? 0}
                userRevokedCount={s?.revoked ?? 0}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
