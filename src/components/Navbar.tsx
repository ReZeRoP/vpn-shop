import Link from "next/link";
import { currentUser } from "@/lib/auth-server";

export default async function Navbar() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-fg">
            <span className="text-accent">⚡</span> فروشگاه کانفیگ
          </Link>
          <div className="hidden items-center gap-4 text-sm text-muted sm:flex">
            <Link href="/#plans" className="hover:text-fg">خرید سرویس</Link>
            <Link href="/chat" className="hover:text-fg">گفتگو</Link>
            <Link href="/guide" className="hover:text-fg">آموزش اتصال</Link>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className="text-warn hover:text-fg">مدیریت</Link>
              )}
              <Link
                href="/dashboard"
                className="rounded-lg border border-line bg-panel px-3 py-1.5 hover:bg-panel-2"
              >
                {user.username}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-fg">ورود</Link>
              <Link
                href="/register"
                className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-hover"
              >
                ثبت‌نام
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
