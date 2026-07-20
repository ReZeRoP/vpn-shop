import Link from "next/link";
import Navbar from "@/components/Navbar";
import { db, tables } from "@/db";
import { eq, asc } from "drizzle-orm";
import { toman, gbLabel, faInt } from "@/lib/format";
import { getSetting, SETTING_KEYS } from "@/lib/settings";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "⚡", title: "تحویل آنی", desc: "بلافاصله بعد از ثبت رسید، کانفیگ شما فعال و تحویل داده می‌شود" },
  { icon: "🌍", title: "سرورهای پرسرعت", desc: "اتصال پایدار روی همه اپراتورها؛ همراه اول، ایرانسل و مخابرات" },
  { icon: "📱", title: "همه دستگاه‌ها", desc: "اندروید، آیفون، ویندوز و مک — با لینک اشتراک یک‌بار اضافه کنید" },
  { icon: "💬", title: "گفتگوی زنده", desc: "سوال دارید؟ در چت عمومی سایت از ما و بقیه کاربران بپرسید" },
];

export default async function HomePage() {
  const plans = db
    .select()
    .from(tables.plans)
    .where(eq(tables.plans.active, true))
    .orderBy(asc(tables.plans.sortOrder), asc(tables.plans.priceToman))
    .all();
  const tg = getSetting(SETTING_KEYS.telegramSupport);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 pb-12 pt-20 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
            اینترنت <span className="text-accent">آزاد</span> و پرسرعت،
            <br />
            در چند ثانیه
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-muted">
            خرید کانفیگ اختصاصی V2Ray با تحویل فوری. پرداخت کارت به کارت، فعال‌سازی آنی،
            مدیریت مصرف در پنل کاربری.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <a
              href="#plans"
              className="rounded-xl bg-accent px-6 py-3 font-medium text-white transition hover:bg-accent-hover"
            >
              مشاهده سرویس‌ها
            </a>
            <Link
              href="/chat"
              className="rounded-xl border border-line bg-panel px-6 py-3 font-medium text-fg transition hover:bg-panel-2"
            >
              گفتگوی عمومی
            </Link>
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-12">
          <h2 className="mb-8 text-center text-2xl font-bold">سرویس‌ها</h2>
          {plans.length === 0 ? (
            <p className="rounded-card border border-line bg-panel p-8 text-center text-muted">
              هنوز پلنی ثبت نشده — از پنل مدیریت اضافه کنید
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="group flex flex-col rounded-card border border-line bg-panel p-6 transition hover:border-accent/50 hover:bg-panel-2"
                >
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
                  <ul className="mt-4 space-y-2 text-sm text-muted">
                    <li className="flex items-center gap-2">
                      <span className="text-ok">✓</span> حجم {gbLabel(p.gb)}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-ok">✓</span> مدت {faInt(p.days)} روز
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-ok">✓</span>{" "}
                      {p.limitIp <= 0 ? "کاربر نامحدود" : `${faInt(p.limitIp)} کاربر همزمان`}
                    </li>
                  </ul>
                  <div className="mt-6 flex items-end justify-between">
                    <span className="text-xl font-bold text-ok">{toman(p.priceToman)}</span>
                  </div>
                  <Link
                    href={`/checkout/${p.id}`}
                    className="mt-4 rounded-xl bg-accent py-2.5 text-center font-medium text-white transition group-hover:bg-accent-hover"
                  >
                    خرید
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-4 py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-card border border-line bg-panel p-5">
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-12">
          <h2 className="mb-6 text-center text-2xl font-bold">سوالات متداول</h2>
          <div className="space-y-3">
            {[
              {
                q: "بعد از پرداخت چقدر طول می‌کشد سرویس فعال شود؟",
                a: "بلافاصله! به محض ثبت رسید کارت به کارت، کانفیگ شما ساخته و لینک اشتراک تحویل داده می‌شود.",
              },
              {
                q: "چطور کانفیگ را به گوشی اضافه کنم؟",
                a: "لینک اشتراک را کپی کنید و در برنامه‌هایی مثل v2rayNG (اندروید) یا Streisand (آیفون) وارد کنید. آموزش کامل در بخش «آموزش اتصال» موجود است.",
              },
              {
                q: "اگر رسید نامعتبر ثبت شود چه می‌شود؟",
                a: "رسیدها توسط مدیر بررسی می‌شوند؛ در صورت جعلی بودن رسید، سرویس غیرفعال خواهد شد.",
              },
              {
                q: "مصرف و اعتبار سرویسم را از کجا ببینم؟",
                a: "در پنل کاربری، میزان مصرف، حجم باقیمانده و تاریخ انقضای هر سرویس نمایش داده می‌شود.",
              },
            ].map((item) => (
              <details key={item.q} className="group rounded-card border border-line bg-panel p-4">
                <summary className="cursor-pointer list-none font-medium">{item.q}</summary>
                <p className="mt-3 text-sm leading-7 text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="border-t border-line py-8 text-center text-sm text-muted">
          {tg && (
            <p className="mb-2">
              پشتیبانی تلگرام:{" "}
              <a href={tg} className="text-accent hover:underline" target="_blank">
                {tg.replace(/^https?:\/\//, "")}
              </a>
            </p>
          )}
          © فروشگاه کانفیگ
        </footer>
      </main>
    </>
  );
}
