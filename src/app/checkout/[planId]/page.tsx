import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { toman, gbLabel, faInt } from "@/lib/format";
import StartOrderButton from "@/components/StartOrderButton";

export const metadata = { title: "خرید سرویس" };

export default async function CheckoutPage(props: PageProps<"/checkout/[planId]">) {
  const { planId } = await props.params;
  const user = await currentUser();
  if (!user) redirect(`/login`);

  const plan = db
    .select()
    .from(tables.plans)
    .where(eq(tables.plans.id, Number(planId)))
    .get();
  if (!plan || !plan.active) notFound();

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <h1 className="mb-6 text-center text-2xl font-bold">تأیید سفارش</h1>
        <div className="rounded-card border border-line bg-panel p-6">
          <h2 className="text-lg font-bold">{plan.name}</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>حجم: {gbLabel(plan.gb)}</li>
            <li>مدت: {faInt(plan.days)} روز</li>
            <li>{plan.limitIp <= 0 ? "کاربر نامحدود" : `${faInt(plan.limitIp)} کاربر همزمان`}</li>
          </ul>
          <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
            <span className="text-muted">مبلغ پایه</span>
            <span className="font-bold text-ok">{toman(plan.priceToman)}</span>
          </div>
          <p className="mt-3 text-xs leading-6 text-muted">
            به مبلغ نهایی چند تومان کد یکتا اضافه می‌شود تا پرداخت شما به‌صورت خودکار شناسایی شود.
          </p>
          <StartOrderButton planId={plan.id} />
        </div>
      </main>
    </>
  );
}
