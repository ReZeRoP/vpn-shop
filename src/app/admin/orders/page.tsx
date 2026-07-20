import { db, tables } from "@/db";
import { desc, eq } from "drizzle-orm";
import { toman, jalaliDateTime, ORDER_STATUS_FA } from "@/lib/format";
import OrderActions from "@/components/admin/OrderActions";
import OrdersFilter from "@/components/admin/OrdersFilter";

export const metadata = { title: "سفارش‌ها" };
export const dynamic = "force-dynamic";

const TONE_TEXT = { ok: "text-ok", warn: "text-warn", danger: "text-danger", muted: "text-muted" } as const;

type OrderStatus = (typeof tables.orders.status.enumValues)[number];

export default async function AdminOrdersPage(props: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  // Next 16: searchParams is a Promise
  const { status: rawStatus } = await props.searchParams;
  const statusParam = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const status = tables.orders.status.enumValues.includes(statusParam as OrderStatus)
    ? (statusParam as OrderStatus)
    : undefined;

  const rows = db
    .select({ order: tables.orders, username: tables.users.username })
    .from(tables.orders)
    .innerJoin(tables.users, eq(tables.orders.userId, tables.users.id))
    .where(status ? eq(tables.orders.status, status) : undefined)
    .orderBy(desc(tables.orders.createdAt))
    .limit(200)
    .all();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">سفارش‌ها</h1>
        <OrdersFilter />
      </div>
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
              const s = ORDER_STATUS_FA[o.status] ?? { label: o.status, tone: "muted" as const };
              return (
                <tr key={o.id} className="border-b border-line/50 last:border-0">
                  <td className="p-3 font-mono text-xs">{o.publicId}</td>
                  <td className="p-3">{username}</td>
                  <td className="p-3">{o.planName}</td>
                  <td className="p-3">{toman(o.amountToman)}</td>
                  <td className={`p-3 ${TONE_TEXT[s.tone]}`}>{s.label}</td>
                  <td className="p-3 text-xs text-muted">{jalaliDateTime(o.createdAt)}</td>
                  <td className="p-3">
                    <OrderActions orderId={o.id} status={o.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-8 text-center text-muted">
            {status ? "سفارشی با این وضعیت یافت نشد" : "سفارشی ثبت نشده"}
          </p>
        )}
      </div>
    </div>
  );
}
