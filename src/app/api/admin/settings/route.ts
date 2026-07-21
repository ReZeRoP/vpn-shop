import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-server";
import { setSetting } from "@/lib/settings";

const ALLOWED_KEYS = new Set([
  "card_number",
  "card_holder",
  "panel_url",
  "panel_user",
  "panel_pass",
  "panel_token",
  "panel_insecure_tls",
  "sub_base",
  "public_host",
  "site_name",
  "telegram_support",
  "payment_window_min",
  "max_pending_orders",
]);

export async function POST(req: NextRequest) {
  const admin = await currentUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_KEYS.has(key) && typeof value === "string") {
      setSetting(key, value.trim());
    }
  }
  return NextResponse.json({ ok: true });
}
