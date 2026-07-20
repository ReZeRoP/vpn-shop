"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS: { key: string; label: string; ltr?: boolean; hint?: string }[] = [
  { key: "card_number", label: "شماره کارت مقصد", ltr: true },
  { key: "card_holder", label: "نام صاحب کارت (به نام)" },
  { key: "panel_url", label: "آدرس پنل 3x-ui", ltr: true, hint: "مثال: https://1.2.3.4:2053/Xr2fK9dQ — شامل مسیر پایه" },
  { key: "panel_user", label: "نام کاربری پنل", ltr: true },
  { key: "panel_pass", label: "رمز پنل", ltr: true },
  { key: "panel_token", label: "توکن API پنل (اختیاری — پنل v3)", ltr: true, hint: "در پنل: Settings → Security → API Token؛ اگر ست شود جایگزین نام کاربری/رمز می‌شود" },
  { key: "panel_insecure_tls", label: "پذیرش TLS خودامضا (1/0)", ltr: true, hint: "اگر پنل گواهی معتبر ندارد 1 بگذارید" },
  { key: "sub_base", label: "آدرس پایه Subscription", ltr: true, hint: "مثال: https://1.2.3.4:2096/sub" },
  { key: "public_host", label: "آدرس عمومی سرور (برای لینک vless)", ltr: true },
  { key: "telegram_support", label: "لینک تلگرام پشتیبانی", ltr: true },
  { key: "payment_window_min", label: "مهلت پرداخت (دقیقه)", ltr: true },
  { key: "max_pending_orders", label: "حداکثر سفارش باز هر کاربر", ltr: true },
];

export default function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testSteps, setTestSteps] = useState<{ step: string; ok: boolean; detail: string }[] | null>(null);
  const [testError, setTestError] = useState("");

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setBusy(false);
    setMsg(res.ok ? "✓ ذخیره شد" : "خطا در ذخیره");
    router.refresh();
  }

  async function testPanel() {
    setTesting(true);
    setTestSteps(null);
    setTestError("");
    try {
      const res = await fetch("/api/admin/settings/test-panel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.steps)) {
        setTestSteps(data.steps);
      } else {
        setTestError(data.error || "خطای نامشخص در آزمایش اتصال");
      }
    } catch {
      setTestError("خطا در ارتباط با سرور");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="mb-1 block text-sm text-muted">{f.label}</label>
          <input
            dir={f.ltr ? "ltr" : "rtl"}
            value={values[f.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2">
        <button
          disabled={busy}
          onClick={save}
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          ذخیره تنظیمات
        </button>
        <button
          disabled={testing}
          onClick={testPanel}
          className="rounded-xl border border-line px-6 py-2.5 text-sm text-muted hover:text-fg disabled:opacity-50"
        >
          {testing ? "در حال آزمایش..." : "آزمایش اتصال پنل"}
        </button>
        {msg && <span className="text-sm text-ok">{msg}</span>}
      </div>
      {testError && <p className="text-sm text-danger">✗ {testError}</p>}
      {testSteps && (
        <ul className="space-y-2 rounded-card border border-line bg-panel p-4">
          {testSteps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className={s.ok ? "text-ok" : "text-danger"}>{s.ok ? "✓" : "✗"}</span>
              <div>
                <span className={s.ok ? "text-ok" : "text-danger"}>{s.step}</span>
                <p className="mt-0.5 text-xs text-muted" dir="auto">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
