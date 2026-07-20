"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Plan {
  id: number;
  name: string;
  days: number;
  gb: number;
  limitIp: number;
  priceToman: number;
  inboundId: number;
  description: string | null;
  sortOrder: number;
  active: boolean;
}

const EMPTY: Omit<Plan, "id"> = {
  name: "",
  days: 30,
  gb: 50,
  limitIp: 0,
  priceToman: 100000,
  inboundId: 1,
  description: "",
  sortOrder: 0,
  active: true,
};

export default function PlanEditor({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<(Omit<Plan, "id"> & { id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "خطا");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(id: number) {
    if (!confirm("پلن حذف شود؟ (سفارش‌های قبلی حفظ می‌شوند)")) return;
    await fetch("/api/admin/plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  const numField = (
    label: string,
    key: "days" | "gb" | "limitIp" | "priceToman" | "inboundId" | "sortOrder",
  ) => (
    <div>
      <label className="mb-1 block text-xs text-muted">{label}</label>
      <input
        dir="ltr"
        type="number"
        value={editing?.[key] ?? 0}
        onChange={(e) => setEditing((p) => p && { ...p, [key]: Number(e.target.value) })}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {!editing && (
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + پلن جدید
        </button>
      )}

      {editing && (
        <div className="rounded-card border border-accent/40 bg-panel p-5">
          <h2 className="mb-4 font-bold">{editing.id ? "ویرایش پلن" : "پلن جدید"}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-3">
              <label className="mb-1 block text-xs text-muted">نام پلن</label>
              <input
                value={editing.name}
                onChange={(e) => setEditing((p) => p && { ...p, name: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            {numField("مدت (روز)", "days")}
            {numField("حجم (گیگ، ۰=نامحدود)", "gb")}
            {numField("تعداد کاربر (۰=نامحدود)", "limitIp")}
            {numField("قیمت (تومان)", "priceToman")}
            {numField("شناسه اینباند پنل", "inboundId")}
            {numField("ترتیب نمایش", "sortOrder")}
            <div className="col-span-2 sm:col-span-3">
              <label className="mb-1 block text-xs text-muted">توضیح (اختیاری)</label>
              <input
                value={editing.description ?? ""}
                onChange={(e) => setEditing((p) => p && { ...p, description: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing((p) => p && { ...p, active: e.target.checked })}
              />
              فعال
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              disabled={busy || !editing.name}
              onClick={save}
              className="rounded-lg bg-accent px-5 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
            >
              ذخیره
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg border border-line px-5 py-2 text-sm text-muted hover:text-fg"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs text-muted">
              <th className="p-3">نام</th>
              <th className="p-3">مدت</th>
              <th className="p-3">حجم</th>
              <th className="p-3">قیمت</th>
              <th className="p-3">اینباند</th>
              <th className="p-3">وضعیت</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {initialPlans.map((p) => (
              <tr key={p.id} className="border-b border-line/50 last:border-0">
                <td className="p-3">{p.name}</td>
                <td className="p-3">{p.days} روز</td>
                <td className="p-3">{p.gb === 0 ? "نامحدود" : `${p.gb} گیگ`}</td>
                <td className="p-3">{p.priceToman.toLocaleString("fa-IR")}</td>
                <td className="p-3 font-mono text-xs">{p.inboundId}</td>
                <td className="p-3">{p.active ? <span className="text-ok">فعال</span> : <span className="text-muted">غیرفعال</span>}</td>
                <td className="p-3 space-x-2 space-x-reverse whitespace-nowrap">
                  <button onClick={() => setEditing(p)} className="text-xs text-accent hover:underline">
                    ویرایش
                  </button>{" "}
                  <button onClick={() => remove(p.id)} className="text-xs text-danger hover:underline">
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {initialPlans.length === 0 && <p className="p-8 text-center text-muted">پلنی ثبت نشده</p>}
      </div>
    </div>
  );
}
