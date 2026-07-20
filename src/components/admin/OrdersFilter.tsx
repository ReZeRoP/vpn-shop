"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ORDER_STATUS_FA } from "@/lib/format";

export default function OrdersFilter() {
  const router = useRouter();
  const current = useSearchParams().get("status") ?? "";

  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `/admin/orders?status=${v}` : "/admin/orders");
      }}
      className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-fg outline-none focus:border-accent"
    >
      <option value="">همه</option>
      {Object.entries(ORDER_STATUS_FA).map(([value, meta]) => (
        <option key={value} value={value}>
          {meta.label}
        </option>
      ))}
    </select>
  );
}
