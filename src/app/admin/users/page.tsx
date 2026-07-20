import { db, tables } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { jalaliDate, faInt } from "@/lib/format";
import UserActions from "@/components/admin/UserActions";

export const metadata = { title: "کاربران" };
export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  const rows = db
    .select({
      user: tables.users,
      orderCount: sql<number>`(select count(*) from orders where orders.user_id = users.id)`,
    })
    .from(tables.users)
    .orderBy(desc(tables.users.createdAt))
    .limit(300)
    .all();

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">کاربران</h1>
      <div className="overflow-x-auto rounded-card border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs text-muted">
              <th className="p-3">نام کاربری</th>
              <th className="p-3">نقش</th>
              <th className="p-3">سفارش‌ها</th>
              <th className="p-3">خریدار تأییدشده</th>
              <th className="p-3">عضویت</th>
              <th className="p-3">وضعیت</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user: u, orderCount }) => (
              <tr key={u.id} className="border-b border-line/50 last:border-0">
                <td className="p-3 font-medium">{u.username}</td>
                <td className="p-3">{u.role === "admin" ? <span className="text-warn">مدیر</span> : "کاربر"}</td>
                <td className="p-3">{faInt(orderCount)}</td>
                <td className="p-3">{u.verifiedBuyer ? <span className="text-ok">✓</span> : "—"}</td>
                <td className="p-3 text-xs text-muted">{jalaliDate(u.createdAt)}</td>
                <td className="p-3">
                  {u.banned ? (
                    <span className="text-danger">مسدود</span>
                  ) : u.chatMutedUntil && u.chatMutedUntil > Date.now() ? (
                    <span className="text-warn">بی‌صدا</span>
                  ) : (
                    <span className="text-ok">عادی</span>
                  )}
                </td>
                <td className="p-3">
                  {u.role !== "admin" && <UserActions userId={u.id} banned={u.banned} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
