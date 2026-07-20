"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserActions({ userId, banned }: { userId: number; banned: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: string, minutes?: number) {
    setBusy(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, minutes }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "خطا");
      return;
    }
    router.refresh();
  }

  return (
    <span className="space-x-2 space-x-reverse whitespace-nowrap text-xs">
      {banned ? (
        <button disabled={busy} onClick={() => act("unban")} className="text-ok hover:underline">
          رفع مسدودی
        </button>
      ) : (
        <>
          <button disabled={busy} onClick={() => act("mute", 60)} className="text-warn hover:underline">
            بی‌صدا ۱س
          </button>{" "}
          <button disabled={busy} onClick={() => act("ban")} className="text-danger hover:underline">
            مسدود
          </button>
        </>
      )}
    </span>
  );
}
