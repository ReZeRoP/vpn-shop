import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { db, tables } from "@/db";
import { and, eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { deliveredConfigFor } from "@/lib/orders";
import { ORDER_STATUS_FA, jalaliDate, toman } from "@/lib/format";
import CopyButton from "@/components/CopyButton";
import QRCode from "qrcode";
import Link from "next/link";

export const metadata = { title: "سفارش" };

const TONE_CLASS = {
  ok: "text-ok border-ok/30 bg-ok/5",
  warn: "text-warn border-warn/30 bg-warn/5",
  danger: "text-danger border-danger/30 bg-danger/5",
  muted: "text-muted border-line bg-panel",
} as const;

export default async function OrderPage(props: PageProps<"/order/[publicId]">) {
  const { publicId } = await props.params;
  const user = await currentUser();
  if (!user) redirect("/login");

  const order = db
    .select()
    .from(tables.orders)
    .where(and(eq(tables.orders.publicId, publicId), eq(tables.orders.userId, user.id)))
    .get();
  if (!order) notFound();

  const status = ORDER_STATUS_FA[order.status] ?? { label: order.status, tone: "muted" as const };
  const delivered = order.status === "approved" || order.status === "verified";

  let subUrl = "";
  let vlessLink: string | null = null;
  let qrDataUrl = "";
  if (delivered && order.subId) {
    try {
      const cfg = await deliveredConfigFor(order.id);
      subUrl = cfg.subUrl;
      vlessLink = cfg.vlessLink;
      if (subUrl) {
        qrDataUrl = await QRCode.toDataURL(subUrl, { margin: 1, width: 220, color: { dark: "#e7eaf2", light: "#11151f" } });
      }
    } catch {
      // panel temporarily unreachable; still show status
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <h1 className="mb-6 text-center text-2xl font-bold">سفارش #{order.publicId}</h1>

        <div className={`rounded-card border p-4 text-center text-sm font-medium ${TONE_CLASS[status.tone]}`}>
          {status.label}
          {order.status === "revoked" && order.revokeReason && (
            <p className="mt-2 text-xs font-normal">دلیل: {order.revokeReason}</p>
          )}
          {order.status === "held" && (
            <p className="mt-2 text-xs font-normal text-muted">
              رسید شما در صف بررسی مدیر است؛ پس از تأیید، سرویس فعال می‌شود
            </p>
          )}
        </div>

        <div className="mt-4 rounded-card border border-line bg-panel p-5 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-muted">سرویس</span>
            <span>{order.planName}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted">مبلغ</span>
            <span>{toman(order.amountToman)}</span>
          </div>
          {order.expiresAt && (
            <div className="flex justify-between py-1.5">
              <span className="text-muted">انقضا</span>
              <span>{jalaliDate(order.expiresAt)}</span>
            </div>
          )}
        </div>

        {delivered && subUrl && (
          <div className="mt-4 rounded-card border border-line bg-panel p-5">
            <h2 className="mb-3 text-center font-bold text-ok">🎉 کانفیگ شما آماده است</h2>
            {qrDataUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR لینک اشتراک" className="rounded-xl border border-line" />
              </div>
            )}
            <div className="mt-4">
              <label className="mb-1 block text-xs text-muted">لینک اشتراک (Subscription)</label>
              <div className="flex items-center gap-2">
                <code className="ltr flex-1 truncate rounded-lg border border-line bg-surface px-3 py-2 text-xs">
                  {subUrl}
                </code>
                <CopyButton text={subUrl} />
              </div>
            </div>
            {vlessLink && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-muted">لینک مستقیم (VLESS)</label>
                <div className="flex items-center gap-2">
                  <code className="ltr flex-1 truncate rounded-lg border border-line bg-surface px-3 py-2 text-xs">
                    {vlessLink}
                  </code>
                  <CopyButton text={vlessLink} />
                </div>
              </div>
            )}
            <p className="mt-4 text-xs leading-6 text-muted">
              لینک اشتراک را در v2rayNG (اندروید) یا Streisand (آیفون) وارد کنید.{" "}
              <Link href="/guide" className="text-accent hover:underline">
                آموزش کامل اتصال ←
              </Link>
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-sm text-accent hover:underline">
            رفتن به پنل کاربری ←
          </Link>
        </div>
      </main>
    </>
  );
}
