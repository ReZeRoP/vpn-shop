import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth-server";
import Navbar from "@/components/Navbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login");

  return (
    <>
      <Navbar />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-8">
        <aside className="w-44 shrink-0">
          <nav className="sticky top-20 space-y-1 text-sm">
            {[
              { href: "/admin", label: "📥 صف رسیدها" },
              { href: "/admin/orders", label: "🧾 سفارش‌ها" },
              { href: "/admin/plans", label: "📦 پلن‌ها" },
              { href: "/admin/users", label: "👥 کاربران" },
              { href: "/admin/settings", label: "⚙️ تنظیمات" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block rounded-lg px-3 py-2 text-muted transition hover:bg-panel hover:text-fg"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
