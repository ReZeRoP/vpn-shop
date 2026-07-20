"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CopyButton from "@/components/CopyButton";

const faNum = new Intl.NumberFormat("fa-IR");

export default function PaymentCard({
  publicId,
  planName,
  amountToman,
  cardNumber,
  cardHolder,
  deadline,
}: {
  publicId: string;
  planName: string;
  amountToman: number;
  cardNumber: string;
  cardHolder: string;
  deadline: number;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(Math.max(0, deadline - Date.now()));
  const [file, setFile] = useState<File | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [payerCardLast4, setPayerCardLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, deadline - Date.now())), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  const mins = Math.floor(left / 60_000);
  const secs = Math.floor((left % 60_000) / 1000);
  const spacedCard = cardNumber.replace(/[^0-9]/g, "").replace(/(.{4})/g, "$1 ").trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("تصویر رسید را انتخاب کنید");
      return;
    }
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("image", file);
    if (trackingCode) fd.set("trackingCode", trackingCode);
    if (payerCardLast4) fd.set("payerCardLast4", payerCardLast4);
    const res = await fetch(`/api/orders/${publicId}/receipt`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "خطایی رخ داد");
      return;
    }
    router.push(`/order/${publicId}`);
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-2 text-center text-2xl font-bold">پرداخت کارت به کارت</h1>
      <p className="mb-6 text-center text-sm text-muted">{planName}</p>

      {/* stylized bank card */}
      <div className="rounded-card border border-line bg-gradient-to-bl from-panel-2 to-panel p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">شماره کارت مقصد</span>
          <span className="text-lg">💳</span>
        </div>
        <div className="ltr mt-3 text-center font-mono text-xl tracking-wider text-fg">
          {spacedCard || "—"}
        </div>
        <div className="mt-2 text-center text-sm text-muted">به نام {cardHolder}</div>
        <div className="mt-4 flex justify-center">
          <CopyButton text={cardNumber.replace(/[^0-9]/g, "")} label="کپی شماره کارت" />
        </div>
      </div>

      {/* amount */}
      <div className="mt-4 rounded-card border border-warn/30 bg-warn/5 p-4 text-center">
        <div className="text-sm text-muted">مبلغ قابل پرداخت — دقیقاً همین مبلغ را واریز کنید</div>
        <div className="mt-1 text-2xl font-extrabold text-warn">
          {faNum.format(amountToman)} تومان
        </div>
        <div className="mt-2 flex justify-center">
          <CopyButton text={String(amountToman)} label="کپی مبلغ" />
        </div>
        <p className="mt-2 text-xs text-muted">
          چند تومان انتهای مبلغ، کد شناسایی پرداخت شماست
        </p>
      </div>

      {/* countdown */}
      <p className="mt-3 text-center text-sm text-muted">
        {left > 0 ? (
          <>
            مهلت پرداخت:{" "}
            <span className="font-bold text-fg">
              {faNum.format(mins)}:{faNum.format(secs).padStart(2, "۰")}
            </span>
          </>
        ) : (
          <span className="text-danger">مهلت پرداخت تمام شد — سفارش جدیدی ثبت کنید</span>
        )}
      </p>

      {/* receipt form */}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-card border-2 border-dashed border-line bg-panel p-6 text-center transition hover:border-accent/60"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <span className="text-sm text-ok">✓ {file.name}</span>
          ) : (
            <>
              <div className="text-2xl">🧾</div>
              <p className="mt-2 text-sm text-muted">تصویر رسید را اینجا انتخاب کنید</p>
              <p className="mt-1 text-xs text-muted">JPG / PNG / WebP — حداکثر ۵ مگابایت</p>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">شماره پیگیری (اختیاری)</label>
            <input
              dir="ltr"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              className="w-full rounded-xl border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">۴ رقم آخر کارت شما (اختیاری)</label>
            <input
              dir="ltr"
              maxLength={4}
              value={payerCardLast4}
              onChange={(e) => setPayerCardLast4(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full rounded-xl border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          disabled={busy || left <= 0}
          className="w-full rounded-xl bg-accent py-3 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "در حال ثبت..." : "ثبت رسید و دریافت کانفیگ"}
        </button>
      </form>
    </div>
  );
}
