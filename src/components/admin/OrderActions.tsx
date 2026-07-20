"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderActions({ orderId, status }: { orderId: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "revoke" | "unrevoke") {
    const reason = action === "revoke" ? prompt("دلیل لغو؟") : null;
    if (action === "revoke" && !reason) return;
    setBusy(true);
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "خطا");
      return;
    }
    router.refresh();
  }

  if (status === "approved" || status === "verified") {
    return (
      <button
        disabled={busy}
        onClick={() => act("revoke")}
        className="text-xs text-danger hover:underline disabled:opacity-50"
      >
        لغو سرویس
      </button>
    );
  }
  if (status === "revoked") {
    return (
      <button
        disabled={busy}
        onClick={() => act("unrevoke")}
        className="text-xs text-ok hover:underline disabled:opacity-50"
      >
        فعال‌سازی مجدد
      </button>
    );
  }
  return null;
}
