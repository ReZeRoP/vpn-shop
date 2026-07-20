import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db, tables } from "@/db";
import { currentUser } from "@/lib/auth-server";
import { faInt } from "@/lib/format";
import Navbar from "@/components/Navbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login");

  const pendingReceipts =
    db
      .select({ n: sql<number>`count(*)` })
      .from(tables.receipts)
      .where(eq(tables.receipts.reviewStatus, "pending"))
      .get()?.n ?? 0;

  return (
    <>
      <Navbar />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-8">
        <aside className="w-44 shrink-0">
          <nav className="sticky top-20 space-y-1 text-sm">
            {[
              { href: "/admin", label: "📥 صف رسیدها", badge: pendingReceipts },
              { href: "/admin/orders", label: "🧾 سفارش‌ها" },
              { href: "/admin/plans", label: "📦 پلن‌ها" },
              { href: "/admin/users", label: "👥 کاربران" },
              { href: "/admin/stats", label: "📈 آمار" },
              { href: "/admin/settings", label: "⚙️ تنظیمات" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-muted transition hover:bg-panel hover:text-fg"
              >
                <span>{l.label}</span>
                {l.badge != null && l.badge > 0 && (
                  <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-bold text-warn">
                    {faInt(l.badge)}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
