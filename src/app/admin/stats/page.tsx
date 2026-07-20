import { getAdminStats } from "@/lib/admin-stats";
import { toman, faInt, ORDER_STATUS_FA } from "@/lib/format";

export const metadata = { title: "آمار" };
export const dynamic = "force-dynamic";

const TONE_TEXT = { ok: "text-ok", warn: "text-warn", danger: "text-danger", muted: "text-muted" } as const;

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-card border border-line bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 text-lg font-bold ${tone ?? "text-fg"}`}>{value}</p>
    </div>
  );
}

export default function AdminStatsPage() {
  const stats = getAdminStats();
  const statusCount = new Map(stats.ordersByStatus.map((s) => [s.status, s.count]));
  const maxSales = Math.max(1, ...stats.topPlans.map((p) => p.sales));

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">📈 آمار فروشگاه</h1>

      {/* revenue */}
      <h2 className="mb-3 text-sm font-bold text-muted">درآمد</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="درآمد امروز" value={toman(stats.revenue.today)} tone="text-ok" />
        <StatCard label="درآمد ۷ روز اخیر" value={toman(stats.revenue.week)} tone="text-ok" />
        <StatCard label="درآمد ۳۰ روز اخیر" value={toman(stats.revenue.month)} tone="text-ok" />
      </div>

      {/* orders + users */}
      <h2 className="mb-3 text-sm font-bold text-muted">سفارش‌ها و کاربران</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Object.entries(ORDER_STATUS_FA).map(([status, meta]) => (
          <StatCard
            key={status}
            label={meta.label}
            value={faInt(statusCount.get(status) ?? 0)}
            tone={TONE_TEXT[meta.tone]}
          />
        ))}
        <StatCard
          label="رسیدهای در انتظار بررسی"
          value={faInt(stats.pendingReceipts)}
          tone={stats.pendingReceipts > 0 ? "text-warn" : "text-muted"}
        />
        <StatCard label="کاربران جدید امروز" value={faInt(stats.newUsers.today)} />
        <StatCard label="کاربران جدید ۷ روز اخیر" value={faInt(stats.newUsers.week)} />
      </div>

      {/* top plans */}
      <h2 className="mb-3 text-sm font-bold text-muted">پرفروش‌ترین پلن‌ها</h2>
      <div className="rounded-card border border-line bg-panel p-4">
        {stats.topPlans.length === 0 ? (
          <p className="p-4 text-center text-muted">هنوز فروشی ثبت نشده</p>
        ) : (
          <ul className="space-y-3">
            {stats.topPlans.map((p) => (
              <li key={p.planName}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{p.planName}</span>
                  <span className="text-muted">{faInt(p.sales)} فروش</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.round((p.sales / maxSales) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
