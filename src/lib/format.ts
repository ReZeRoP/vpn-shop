// Formatting helpers: Persian digits, Toman prices, Jalali dates, traffic sizes.

const faNum = new Intl.NumberFormat("fa-IR");
const faDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const faDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function faInt(n: number): string {
  return faNum.format(n);
}

export function toman(n: number): string {
  return `${faNum.format(n)} تومان`;
}

export function jalaliDate(msEpoch: number): string {
  return faDate.format(new Date(msEpoch));
}

export function jalaliDateTime(msEpoch: number): string {
  return faDateTime.format(new Date(msEpoch));
}

export function gbLabel(gb: number): string {
  return gb <= 0 ? "نامحدود" : `${faNum.format(gb)} گیگ`;
}

export function bytesToGb(bytes: number): number {
  return Math.round((bytes / 1024 ** 3) * 100) / 100;
}

export function trafficLabel(bytes: number): string {
  if (bytes < 1024 ** 2) return `${faNum.format(Math.round(bytes / 1024))} کیلوبایت`;
  if (bytes < 1024 ** 3) return `${faNum.format(Math.round(bytes / 1024 ** 2))} مگابایت`;
  return `${faNum.format(bytesToGb(bytes))} گیگابایت`;
}

export function daysLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000));
}

/** Relative time for chat timestamps. */
export function faTimeAgo(msEpoch: number): string {
  const diff = Date.now() - msEpoch;
  if (diff < 60_000) return "لحظاتی پیش";
  if (diff < 3_600_000) return `${faNum.format(Math.floor(diff / 60_000))} دقیقه پیش`;
  if (diff < 86_400_000) return `${faNum.format(Math.floor(diff / 3_600_000))} ساعت پیش`;
  return jalaliDate(msEpoch);
}

export const ORDER_STATUS_FA: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  pending_payment: { label: "در انتظار پرداخت", tone: "warn" },
  held: { label: "در انتظار بررسی رسید", tone: "warn" },
  approved: { label: "فعال (در انتظار تأیید نهایی)", tone: "ok" },
  verified: { label: "فعال", tone: "ok" },
  revoked: { label: "لغو شده (رسید نامعتبر)", tone: "danger" },
  rejected: { label: "رد شده", tone: "danger" },
  expired: { label: "منقضی", tone: "muted" },
};
