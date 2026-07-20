import Navbar from "@/components/Navbar";

export const metadata = { title: "آموزش اتصال" };

const GUIDES = [
  {
    os: "اندروید",
    icon: "🤖",
    app: "v2rayNG",
    link: "https://github.com/2dust/v2rayNG/releases",
    steps: [
      "برنامه v2rayNG را از گیت‌هاب دانلود و نصب کنید",
      "لینک اشتراک (Subscription) را از صفحه سفارش خود کپی کنید",
      "در v2rayNG روی ⋮ بزنید → «Subscription group setting» → +",
      "لینک را در قسمت URL جای‌گذاری و ذخیره کنید",
      "از منوی ⋮ گزینه «Update subscription» را بزنید",
      "سرور را انتخاب و دکمه اتصال (V پایین صفحه) را بزنید",
    ],
  },
  {
    os: "آیفون (iOS)",
    icon: "🍎",
    app: "Streisand یا V2Box",
    link: "https://apps.apple.com/app/streisand/id6450534064",
    steps: [
      "برنامه Streisand را از اپ‌استور نصب کنید (یا V2Box)",
      "لینک اشتراک را از صفحه سفارش کپی کنید",
      "در Streisand روی + بالای صفحه بزنید → «Import from clipboard»",
      "کانفیگ‌ها اضافه می‌شوند؛ یکی را انتخاب کنید",
      "دکمه اتصال را بزنید و اجازه افزودن VPN را تأیید کنید",
    ],
  },
  {
    os: "ویندوز",
    icon: "🪟",
    app: "v2rayN",
    link: "https://github.com/2dust/v2rayN/releases",
    steps: [
      "برنامه v2rayN را دانلود کنید (فایل v2rayN-windows-64-SelfContained)",
      "فایل zip را استخراج و v2rayN.exe را اجرا کنید",
      "لینک اشتراک را کپی کنید",
      "در برنامه: Servers → Import from clipboard (یا Ctrl+V)",
      "روی سرور دوبار کلیک کرده و از سیستم‌تری، حالت «Set system proxy» را فعال کنید",
    ],
  },
];

export default function GuidePage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="mb-2 text-center text-2xl font-bold">آموزش اتصال</h1>
        <p className="mb-8 text-center text-sm text-muted">
          سیستم‌عامل خود را انتخاب کنید و مراحل را دنبال کنید
        </p>
        <div className="space-y-4">
          {GUIDES.map((g) => (
            <details key={g.os} className="rounded-card border border-line bg-panel p-5">
              <summary className="cursor-pointer list-none text-lg font-bold">
                {g.icon} {g.os}{" "}
                <span className="text-sm font-normal text-muted">— {g.app}</span>
              </summary>
              <ol className="mt-4 list-inside list-decimal space-y-2.5 text-sm leading-7 text-muted">
                {g.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <a
                href={g.link}
                target="_blank"
                className="mt-4 inline-block text-sm text-accent hover:underline"
              >
                دانلود {g.app} ←
              </a>
            </details>
          ))}
        </div>
        <p className="mt-8 rounded-card border border-line bg-panel p-4 text-center text-sm text-muted">
          مشکلی داشتید؟ در <a href="/chat" className="text-accent hover:underline">گفتگوی عمومی</a> بپرسید
        </p>
      </main>
    </>
  );
}
