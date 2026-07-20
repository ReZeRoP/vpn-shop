import { NextResponse } from "next/server";
import { Agent, fetch as undiciFetch } from "undici";
import { currentUser } from "@/lib/auth-server";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { getXui, XuiError } from "@/lib/xui";

// Staged diagnostics for the 3x-ui panel connection. Instead of one opaque
// error, runs checks in order (config → network → login/API) and returns
// { steps: [{ step, ok, detail }] } — always HTTP 200 so the UI can render
// partial progress.

type Step = { step: string; ok: boolean; detail: string };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function checkConfig(steps: Step[]): boolean {
  const url = getSetting(SETTING_KEYS.panelUrl);
  const user = getSetting(SETTING_KEYS.panelUser);
  const pass = getSetting(SETTING_KEYS.panelPass);
  const token = getSetting(SETTING_KEYS.panelToken);

  if (!url) {
    steps.push({ step: "تنظیمات", ok: false, detail: "آدرس پنل تنظیم نشده است" });
    return false;
  }
  if (!token && (!user || !pass)) {
    steps.push({
      step: "تنظیمات",
      ok: false,
      detail: "نام کاربری/رمز پنل (یا توکن API) تنظیم نشده است",
    });
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    steps.push({ step: "تنظیمات", ok: false, detail: "آدرس پنل معتبر نیست (URL قابل تجزیه نیست)" });
    return false;
  }

  const hasBasePath = parsed.pathname.replace(/\/+$/, "").length > 0;
  steps.push({
    step: "تنظیمات",
    ok: true,
    detail: hasBasePath
      ? `آدرس و اطلاعات ورود موجود است (${token ? "توکن API" : "نام کاربری/رمز"})`
      : "هشدار: آدرس پنل معمولاً یک مسیر تصادفی دارد مثل /AbCdEf — اگر پنل شما مسیر پایه دارد آن را به آدرس اضافه کنید",
  });
  return true;
}

async function checkNetwork(steps: Step[]): Promise<boolean> {
  const url = getSetting(SETTING_KEYS.panelUrl);
  const insecure = getSetting(SETTING_KEYS.panelInsecureTls) === "1";
  const dispatcher = insecure
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;
  try {
    const res = await undiciFetch(url, {
      method: "GET",
      headers: { "User-Agent": UA },
      dispatcher,
      signal: AbortSignal.timeout(10_000),
    });
    // Any HTTP response — even 403/404 — proves the server is reachable.
    steps.push({
      step: "دسترسی شبکه",
      ok: true,
      detail: `سرور پاسخ داد (HTTP ${res.status})`,
    });
    return true;
  } catch (e) {
    steps.push({ step: "دسترسی شبکه", ok: false, detail: networkErrorDetail(e) });
    return false;
  } finally {
    await dispatcher?.close().catch(() => {});
  }
}

function networkErrorDetail(e: unknown): string {
  const err = e as Error & { cause?: Error & { code?: string } };
  const cause = err.cause ?? err;
  const code = (cause as { code?: string }).code ?? "";
  const text = `${err.name} ${err.message} ${cause.name ?? ""} ${cause.message ?? ""} ${code}`;

  if (err.name === "TimeoutError" || err.name === "AbortError" || /UND_ERR_(CONNECT_)?TIMEOUT/i.test(text)) {
    return "سرور پاسخ نداد — آدرس/پورت یا فایروال را بررسی کنید";
  }
  if (/CERT|TLS|SSL|HANDSHAKE|self[- ]?signed|UNABLE_TO_VERIFY|DEPTH_ZERO/i.test(text)) {
    return "خطای گواهی TLS — گزینه پذیرش TLS خودامضا را فعال کنید";
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ECONNRESET/i.test(text)) {
    return "اتصال برقرار نشد — آدرس یا پورت اشتباه است";
  }
  return `خطای شبکه: ${cause.message || err.message}`;
}

async function checkLogin(steps: Step[]): Promise<void> {
  try {
    const inbounds = await getXui().listInbounds();
    steps.push({
      step: "ورود به پنل",
      ok: true,
      detail:
        inbounds.length === 0
          ? "ورود موفق — هیچ اینباندی یافت نشد"
          : `${inbounds.length} اینباند: ` +
            inbounds.map((i) => `#${i.id} ${i.remark} (${i.protocol}:${i.port})`).join("، "),
    });
  } catch (e) {
    const err = e as Error;
    const status = e instanceof XuiError ? e.status : undefined;
    let detail = err.message;
    if (status === 403 || /403/.test(err.message)) {
      detail += " (اگر پنل نسخه ۳ است می‌توانید به‌جای نام کاربری/رمز از توکن API استفاده کنید)";
    }
    steps.push({ step: "ورود به پنل", ok: false, detail });
  }
}

export async function POST() {
  const admin = await currentUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const steps: Step[] = [];
  if (checkConfig(steps)) {
    if (await checkNetwork(steps)) {
      await checkLogin(steps);
    }
  }
  return NextResponse.json({ steps });
}
