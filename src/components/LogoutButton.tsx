"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-muted transition hover:text-danger"
    >
      خروج
    </button>
  );
}
