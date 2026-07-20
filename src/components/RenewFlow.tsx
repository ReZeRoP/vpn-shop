"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RenewFlow({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function renew() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/orders/${publicId}/renew`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "خطایی رخ داد");
      return;
    }
    router.push(`/pay/${data.publicId}`);
  }

  return (
    <>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button
        onClick={renew}
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? "..." : "تمدید و پرداخت"}
      </button>
    </>
  );
}
