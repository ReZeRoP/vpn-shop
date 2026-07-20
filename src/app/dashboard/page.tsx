import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { db, tables } from "@/db";
import { desc, eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { getXui, type ClientTraffic } from "@/lib/xui";
import { ORDER_STATUS_FA, jalaliDate, trafficLabel, gbLabel, toman } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";

export const metadata = { title: "پنل کاربری" };
export const dynamic = "force-dynamic";

// 60s in-process traffic cache so many dashboard views don't hammer the panel
const trafficCache = new Map<string, { data: ClientTraffic | null; at: number }>();
async function cachedTraffic(email: string): Promise<ClientTraffic | null> {
  const hit = trafficCache.get(email);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  try {
    const data = await getXui().getClientTraffic(email);
    trafficCache.set(email, { data, at: Date.now() });
    return data;
  } catch {
    return hit?.data ?? null;
  }
}

const TONE_TEXT = { ok: "text-ok", warn: "text-warn", danger: "text-danger", muted: "text-muted" } as const;

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const orders = db
    .select()
    .from(tables.orders)
    .where(eq(tables.orders.userId, user.id))
    .orderBy(desc(tables.orders.createdAt))
    .all();

  const active = orders.filter((o) => o.status === "approved" || o.status === "verified");
  const traffics = await Promise.all(
    active.map(async (o) => [o.id, o.xuiEmail ? await cachedTraffic(o.xuiEmail) : null] as const),
  );
  const trafficMap = new Map(traffics);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">پنل کاربری</h1>
            <p className="mt-1 text-sm text-muted">{user.username}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm hover:bg-panel-2"
            >
              حساب کاربری
            </Link>
            <LogoutButton />
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-card border border-line bg-panel p-10 text-center">
            <p className="text-muted">هنوز سرویسی نخریده‌اید</p>
            <Link
              href="/#plans"
              className="mt-4 inline-block rounded-xl bg-accent px-6 py-2.5 font-medium text-white hover:bg-accent-hover"
            >
              مشاهده سرویس‌ها
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const status = ORDER_STATUS_FA[o.status] ?? { label: o.status, tone: "muted" as const };
              const t = trafficMap.get(o.id);
              const used = t ? t.up + t.down : 0;
              const total = t?.total ?? 0;
              const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
              return (
                <div key={o.id} className="rounded-card border border-line bg-panel p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold">{o.planName}</h2>
                      <p className="mt-0.5 text-xs text-muted">
                        سفارش #{o.publicId} — {toman(o.amountToman)}
                      </p>
                    </div>
                    <span className={`text-sm font-medium ${TONE_TEXT[status.tone]}`}>{status.label}</span>
                  </div>

                  {(o.status === "approved" || o.status === "verified") && (
                    <>
                      {t && (
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-muted">
                            <span>مصرف: {trafficLabel(used)}</span>
                            <span>{total > 0 ? `از ${trafficLabel(total)}` : `حجم ${gbLabel(o.gb)}`}</span>
                          </div>
                          {total > 0 && (
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                              <div
                                className={`h-full rounded-full ${pct > 85 ? "bg-danger" : pct > 60 ? "bg-warn" : "bg-ok"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-4 flex items-center justify-between text-sm">
                        {o.expiresAt && (
                          <span className="text-muted">انقضا: {jalaliDate(o.expiresAt)}</span>
                        )}
                        <div className="flex items-center gap-4">
                          <Link href={`/renew/${o.publicId}`} className="text-accent hover:underline">
                            تمدید
                          </Link>
                          <Link href={`/order/${o.publicId}`} className="text-accent hover:underline">
                            مشاهده کانفیگ ←
                          </Link>
                        </div>
                      </div>
                    </>
                  )}

                  {o.status === "pending_payment" && (
                    <Link
                      href={`/pay/${o.publicId}`}
                      className="mt-3 inline-block text-sm text-accent hover:underline"
                    >
                      ادامه پرداخت ←
                    </Link>
                  )}
                  {o.status === "expired" && (
                    <Link
                      href={`/renew/${o.publicId}`}
                      className="mt-3 inline-block text-sm text-accent hover:underline"
                    >
                      تمدید سرویس ←
                    </Link>
                  )}
                  {o.status === "revoked" && o.revokeReason && (
                    <p className="mt-3 text-xs text-danger">دلیل لغو: {o.revokeReason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
