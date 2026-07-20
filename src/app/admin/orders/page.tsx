import { db, tables } from "@/db";
import { desc, eq } from "drizzle-orm";
import { toman, jalaliDateTime, ORDER_STATUS_FA } from "@/lib/format";
import OrderActions from "@/components/admin/OrderActions";

export const metadata = { title: "سفارش‌ها" };
export const dynamic = "force-dynamic";

const TONE_TEXT = { ok: "text-ok", warn: "text-warn", danger: "text-danger", muted: "text-muted" } as const;

export default function AdminOrdersPage() {
  const rows = db
    .select({ order: tables.orders, username: tables.users.username })
    .from(tables.orders)
    .innerJoin(tables.users, eq(tables.orders.userId, tables.users.id))
    .orderBy(desc(tables.orders.createdAt))
    .limit(200)
    .all();

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">سفارش‌ها</h1>
      <div className="overflow-x-auto rounded-card border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs text-muted">
              <th className="p-3">#</th>
              <th className="p-3">کاربر</th>
              <th className="p-3">سرویس</th>
              <th className="p-3">مبلغ</th>
              <th className="p-3">وضعیت</th>
              <th className="p-3">تاریخ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order: o, username }) => {
              const status = ORDER_STATUS_FA[o.status] ?? { label: o.status, tone: "muted" as const };
              return (
                <tr key={o.id} className="border-b border-line/50 last:border-0">
                  <td className="p-3 font-mono text-xs">{o.publicId}</td>
                  <td className="p-3">{username}</td>
                  <td className="p-3">{o.planName}</td>
                  <td className="p-3">{toman(o.amountToman)}</td>
                  <td className={`p-3 ${TONE_TEXT[status.tone]}`}>{status.label}</td>
                  <td className="p-3 text-xs text-muted">{jalaliDateTime(o.createdAt)}</td>
                  <td className="p-3">
                    <OrderActions orderId={o.id} status={o.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-muted">سفارشی ثبت نشده</p>}
      </div>
    </div>
  );
}
