import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { jalaliDate } from "@/lib/format";
import ProfileForm from "@/components/ProfileForm";

export const metadata = { title: "حساب کاربری" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const row = db
    .select({ createdAt: tables.users.createdAt })
    .from(tables.users)
    .where(eq(tables.users.id, user.id))
    .get();

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <h1 className="mb-8 text-center text-2xl font-bold">حساب کاربری</h1>

        <div className="rounded-card border border-line bg-panel p-5 text-sm">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted">نام کاربری</span>
            <span dir="ltr">{user.username}</span>
          </div>
          {row && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted">تاریخ عضویت</span>
              <span>{jalaliDate(row.createdAt)}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted">وضعیت خریدار</span>
            {user.verifiedBuyer ? (
              <span className="rounded-full border border-ok/30 bg-ok/5 px-2.5 py-0.5 text-xs font-medium text-ok">
                ✓ خریدار تأییدشده
              </span>
            ) : (
              <span className="text-xs text-muted">بدون خرید تأییدشده</span>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-card border border-line bg-panel p-5">
          <h2 className="mb-4 font-bold">تغییر رمز عبور</h2>
          <ProfileForm />
        </div>

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-sm text-accent hover:underline">
            رفتن به پنل کاربری ←
          </Link>
        </div>
      </main>
    </>
  );
}
