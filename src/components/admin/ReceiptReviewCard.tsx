"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const faNum = new Intl.NumberFormat("fa-IR");

export default function ReceiptReviewCard(props: {
  receiptId: number;
  orderPublicId: string;
  orderStatus: string;
  username: string;
  planName: string;
  amountLabel: string;
  submittedLabel: string;
  trackingCode: string | null;
  payerCardLast4: string | null;
  flags: string[];
  userVerifiedCount: number;
  userRevokedCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  async function act(action: "approve" | "reject", mode?: "resubmit" | "revoke") {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/receipts/${props.receiptId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, mode, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "خطا");
      return;
    }
    router.refresh();
  }

  const isHeld = props.orderStatus === "held";

  return (
    <div className="rounded-card border border-line bg-panel p-5">
      <div className="flex flex-wrap gap-5">
        {/* receipt image */}
        <a
          href={`/api/admin/receipts/${props.receiptId}/image`}
          target="_blank"
          className="block h-40 w-32 shrink-0 overflow-hidden rounded-xl border border-line bg-surface"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/admin/receipts/${props.receiptId}/image`}
            alt="رسید"
            className="h-full w-full object-cover transition hover:scale-105"
          />
        </a>

        {/* details */}
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{props.username}</span>
            <span className="text-muted">— سفارش #{props.orderPublicId}</span>
            {isHeld && (
              <span className="rounded-full bg-warn/10 px-2 py-0.5 text-xs text-warn">
                نگه‌داشته‌شده (تحویل نشده)
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-muted">
            <span>سرویس: {props.planName}</span>
            <span>
              مبلغ مورد انتظار: <b className="text-warn">{props.amountLabel}</b>
            </span>
            <span>زمان ثبت: {props.submittedLabel}</span>
            {props.trackingCode && <span className="ltr">پیگیری: {props.trackingCode}</span>}
            {props.payerCardLast4 && <span className="ltr">کارت: ****{props.payerCardLast4}</span>}
            <span>
              سابقه: {faNum.format(props.userVerifiedCount)} تأیید،{" "}
              <b className={props.userRevokedCount > 0 ? "text-danger" : ""}>
                {faNum.format(props.userRevokedCount)} لغو
              </b>
            </span>
          </div>

          {props.flags.length > 0 && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
              {props.flags.map((f) => (
                <div key={f}>⚠ {f}</div>
              ))}
            </div>
          )}

          {/* actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              disabled={busy}
              onClick={() => act("approve")}
              className="rounded-lg bg-ok/15 px-4 py-2 text-ok transition hover:bg-ok/25 disabled:opacity-50"
            >
              ✓ تأیید رسید
            </button>
            <button
              disabled={busy}
              onClick={() => setShowReject((v) => !v)}
              className="rounded-lg bg-danger/10 px-4 py-2 text-danger transition hover:bg-danger/20 disabled:opacity-50"
            >
              ✕ رد رسید
            </button>
            {error && <span className="text-xs text-danger">{error}</span>}
          </div>

          {showReject && (
            <div className="mt-3 space-y-2 rounded-lg border border-line bg-surface p-3">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="دلیل رد (به کاربر نمایش داده می‌شود)"
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2 text-xs">
                <button
                  disabled={busy || !reason.trim()}
                  onClick={() => act("reject", "resubmit")}
                  className="rounded-lg bg-warn/15 px-3 py-2 text-warn hover:bg-warn/25 disabled:opacity-50"
                >
                  رسید نامشخص — اجازه ارسال مجدد
                </button>
                <button
                  disabled={busy || !reason.trim()}
                  onClick={() => act("reject", "revoke")}
                  className="rounded-lg bg-danger/15 px-3 py-2 text-danger hover:bg-danger/25 disabled:opacity-50"
                >
                  رسید جعلی — لغو سرویس
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
