import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { hashPassword, createSession, SESSION_COOKIE } from "@/lib/auth";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));

  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "نام کاربری باید ۳ تا ۲۴ حرف انگلیسی، عدد یا _ باشد" },
      { status: 400 },
    );
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
  }

  const existing = db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.username, username.toLowerCase()))
    .get();
  if (existing) {
    return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = db
    .insert(tables.users)
    .values({ username: username.toLowerCase(), passwordHash })
    .returning({ id: tables.users.id })
    .get();

  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ ok: true });
  // Secure flag must follow the ACTUAL protocol (see login route).
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
