import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { db, tables } from "@/db";
import { and, eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { isRenewable } from "@/lib/renewal";
import { toman, gbLabel, faInt, jalaliDate, ORDER_STATUS_FA } from "@/lib/format";
import RenewFlow from "@/components/RenewFlow";

export const metadata = { title: "تمدید سرویس" };

export default async function RenewPage(props: PageProps<"/renew/[publicId]">) {
  const { publicId } = await props.params;
  const user = await currentUser();
  if (!user) redirect("/login");

  const order = db
    .select()
    .from(tables.orders)
    .where(and(eq(tables.orders.publicId, publicId), eq(tables.orders.userId, user.id)))
    .get();
  if (!order) notFound();
  if (!isRenewable(order.status)) redirect(`/order/${order.publicId}`);

  const status = ORDER_STATUS_FA[order.status] ?? { label: order.status, tone: "muted" as const };

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <h1 className="mb-1 text-center text-2xl font-bold">تمدید سرویس</h1>
        <p className="mb-8 text-center text-sm text-muted">
          سفارش #{order.publicId} — {status.label}
        </p>

        <div className="rounded-card border border-line bg-panel p-5 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-muted">سرویس</span>
            <span>{order.planName}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted">مدت</span>
            <span>{faInt(order.days)} روز</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted">حجم</span>
            <span>{gbLabel(order.gb)}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted">محدودیت دستگاه</span>
            <span>{order.limitIp > 0 ? `${faInt(order.limitIp)} دستگاه` : "نامحدود"}</span>
          </div>
          {order.expiresAt && (
            <div className="flex justify-between py-1.5">
              <span className="text-muted">انقضای فعلی</span>
              <span>{jalaliDate(order.expiresAt)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-line pt-3">
            <span className="text-muted">مبلغ تمدید</span>
            <span className="font-bold">{toman(order.basePriceToman)}</span>
          </div>
        </div>

        <div className="mt-4 rounded-card border border-line bg-panel-2 p-4 text-xs leading-6 text-muted">
          با تمدید، کانفیگ جدیدی با همان مشخصات دریافت می‌کنید. کانفیگ فعلی شما تا زمان
          انقضای خودش فعال می‌ماند.
        </div>

        <RenewFlow publicId={order.publicId} />
      </main>
    </>
  );
}
