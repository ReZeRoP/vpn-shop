import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const vazirmatn = localFont({
  src: "../fonts/Vazirmatn-Variable.woff2",
  variable: "--font-vazirmatn",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "فروشگاه کانفیگ | خرید سرویس پرسرعت",
    template: "%s | فروشگاه کانفیگ",
  },
  description: "خرید آنی کانفیگ V2Ray با تحویل فوری، پشتیبانی و گفتگوی زنده",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-surface text-fg font-sans">
        {children}
      </body>
    </html>
  );
}
