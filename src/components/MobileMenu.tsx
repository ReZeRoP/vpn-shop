"use client";
import { useState } from "react";
import Link from "next/link";

export default function MobileMenu({
  isLoggedIn,
  username,
  isAdmin,
}: {
  isLoggedIn: boolean;
  username: string | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const itemClass =
    "block rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-panel-2 hover:text-fg";

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "بستن منو" : "باز کردن منو"}
        className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-fg hover:bg-panel-2"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-14 z-40 border-b border-line bg-panel shadow-lg">
          <nav className="mx-auto max-w-5xl space-y-1 px-4 py-3">
            <Link href="/#plans" onClick={close} className={itemClass}>
              خرید سرویس
            </Link>
            <Link href="/chat" onClick={close} className={itemClass}>
              گفتگو
            </Link>
            <Link href="/guide" onClick={close} className={itemClass}>
              آموزش اتصال
            </Link>
            <div className="my-2 border-t border-line" />
            {isLoggedIn ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={close}
                    className="block rounded-lg px-3 py-2.5 text-sm text-warn hover:bg-panel-2 hover:text-fg"
                  >
                    مدیریت
                  </Link>
                )}
                <Link
                  href="/dashboard"
                  onClick={close}
                  className="block rounded-lg px-3 py-2.5 text-sm text-fg hover:bg-panel-2"
                >
                  {username}
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" onClick={close} className={itemClass}>
                  ورود
                </Link>
                <Link
                  href="/register"
                  onClick={close}
                  className="block rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover"
                >
                  ثبت‌نام
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
