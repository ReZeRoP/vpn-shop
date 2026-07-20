import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, SESSION_COOKIE } from "@/lib/auth";

// naive per-IP throttle: 10 attempts / 10 min
const attempts = new Map<string, { n: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const a = attempts.get(ip);
  const now = Date.now();
  if (a && a.resetAt > now && a.n >= 10) {
    return NextResponse.json({ error: "تلاش زیاد؛ چند دقیقه بعد دوباره امتحان کنید" }, { status: 429 });
  }

  const { username, password } = await req.json().catch(() => ({}));
  const user =
    typeof username === "string"
      ? db.select().from(tables.users).where(eq(tables.users.username, username.toLowerCase())).get()
      : undefined;

  const valid = user && typeof password === "string" && (await verifyPassword(password, user.passwordHash));
  if (!valid) {
    const cur = a && a.resetAt > now ? a : { n: 0, resetAt: now + 10 * 60_000 };
    cur.n += 1;
    attempts.set(ip, cur);
    return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است" }, { status: 401 });
  }
  if (user.banned) {
    return NextResponse.json({ error: "حساب شما مسدود شده است" }, { status: 403 });
  }

  attempts.delete(ip);
  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ ok: true, role: user.role });
  // Secure flag must follow the ACTUAL protocol — a hardcoded
  // production check breaks login on plain-HTTP deployments (cookie dropped).
  const isHttps =
    req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    expires: new Date(expiresAt),
    path: "/",
  });
  return res;
}
