import { db, tables } from "@/db";
import { eq } from "drizzle-orm";

// Admin-editable site settings, stored as key/value rows.
// Falls back to env vars for panel connection so first boot works from .env alone.

export const SETTING_KEYS = {
  cardNumber: "card_number", // destination card, e.g. 6037-9918-...
  cardHolder: "card_holder", // «به نام»
  panelUrl: "panel_url", // https://host:port/basePath
  panelUser: "panel_user",
  panelPass: "panel_pass",
  panelToken: "panel_token", // v3 API token (alternative to user/pass)
  panelInsecureTls: "panel_insecure_tls", // "1" | "0"
  subBase: "sub_base", // https://host:2096/sub
  publicHost: "public_host", // public address used in vless:// links
  siteName: "site_name",
  telegramSupport: "telegram_support", // t.me/... link
  paymentWindowMin: "payment_window_min", // minutes, default 45
  maxPendingOrders: "max_pending_orders", // per user, default 2
} as const;

const cache = new Map<string, string | null>();
let cacheAt = 0;
const CACHE_TTL = 10_000;

function loadAll(): void {
  const rows = db.select().from(tables.settings).all();
  cache.clear();
  for (const r of rows) cache.set(r.key, r.value);
  cacheAt = Date.now();
}

export function getSetting(key: string, fallback = ""): string {
  if (Date.now() - cacheAt > CACHE_TTL) loadAll();
  return cache.get(key) ?? envFallback(key) ?? fallback;
}

function envFallback(key: string): string | undefined {
  const map: Record<string, string | undefined> = {
    [SETTING_KEYS.panelUrl]: process.env.XUI_PANEL_URL,
    [SETTING_KEYS.panelUser]: process.env.XUI_PANEL_USER,
    [SETTING_KEYS.panelPass]: process.env.XUI_PANEL_PASS,
    [SETTING_KEYS.panelToken]: process.env.XUI_PANEL_TOKEN,
    [SETTING_KEYS.panelInsecureTls]: process.env.XUI_INSECURE_TLS,
    [SETTING_KEYS.subBase]: process.env.XUI_SUB_BASE,
    [SETTING_KEYS.publicHost]: process.env.XUI_PUBLIC_HOST,
  };
  return map[key];
}

export function setSetting(key: string, value: string): void {
  db.insert(tables.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: tables.settings.key, set: { value } })
    .run();
  cache.set(key, value);
}

export function getSettingInt(key: string, fallback: number): number {
  const v = parseInt(getSetting(key), 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
