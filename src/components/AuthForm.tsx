"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "خطایی رخ داد");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="mb-1 text-center text-2xl font-bold">
        {isLogin ? "ورود به حساب" : "ساخت حساب جدید"}
      </h1>
      <p className="mb-8 text-center text-sm text-muted">
        {isLogin ? "خوش برگشتید 👋" : "در چند ثانیه ثبت‌نام کنید"}
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-muted">نام کاربری</label>
          <input
            dir="ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-fg outline-none transition focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">رمز عبور</label>
          <input
            dir="ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={6}
            className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-fg outline-none transition focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          disabled={busy}
          className="w-full rounded-xl bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "..." : isLogin ? "ورود" : "ثبت‌نام"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isLogin ? (
          <>
            حساب ندارید؟{" "}
            <Link href="/register" className="text-accent hover:underline">
              ثبت‌نام کنید
            </Link>
          </>
        ) : (
          <>
            قبلاً ثبت‌نام کرده‌اید؟{" "}
            <Link href="/login" className="text-accent hover:underline">
              وارد شوید
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
