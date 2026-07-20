"use client";
import { useState } from "react";

export default function ProfileForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone(false);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "خطایی رخ داد");
      return;
    }
    setDone(true);
    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm text-muted">رمز عبور فعلی</label>
        <input
          dir="ltr"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-fg outline-none transition focus:border-accent"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-muted">رمز عبور جدید</label>
        <input
          dir="ltr"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-fg outline-none transition focus:border-accent"
        />
        <p className="mt-1.5 text-xs text-muted">حداقل ۶ کاراکتر</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {done && (
        <p className="text-sm text-ok">
          رمز عبور با موفقیت تغییر کرد؛ سایر دستگاه‌ها از حساب خارج شدند
        </p>
      )}

      <button
        disabled={busy}
        className="w-full rounded-xl bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? "..." : "تغییر رمز عبور"}
      </button>
    </form>
  );
}
