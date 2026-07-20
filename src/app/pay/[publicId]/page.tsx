import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { db, tables } from "@/db";
import { and, eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { getSetting, getSettingInt, SETTING_KEYS } from "@/lib/settings";
import PaymentCard from "@/components/PaymentCard";

export const metadata = { title: "پرداخت" };

export default async function PayPage(props: PageProps<"/pay/[publicId]">) {
  const { publicId } = await props.params;
  const user = await currentUser();
  if (!user) redirect("/login");

  const order = db
    .select()
    .from(tables.orders)
    .where(and(eq(tables.orders.publicId, publicId), eq(tables.orders.userId, user.id)))
    .get();
  if (!order) notFound();

  // already handled orders go to their result page
  if (order.status !== "pending_payment") redirect(`/order/${order.publicId}`);

  const cardNumber = getSetting(SETTING_KEYS.cardNumber, "—");
  const cardHolder = getSetting(SETTING_KEYS.cardHolder, "—");
  const windowMin = getSettingInt(SETTING_KEYS.paymentWindowMin, 45);
  const deadline = order.createdAt + windowMin * 60_000;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <PaymentCard
          publicId={order.publicId}
          planName={order.planName}
          amountToman={order.amountToman}
          cardNumber={cardNumber}
          cardHolder={cardHolder}
          deadline={deadline}
        />
      </main>
    </>
  );
}
