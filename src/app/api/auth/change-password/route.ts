import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, tables } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { verifyPassword, hashPassword, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.banned) {
    return NextResponse.json({ error: "ابتدا وارد حساب خود شوید" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "رمز جدید باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
  }

  const row = db
    .select({ passwordHash: tables.users.passwordHash })
    .from(tables.users)
    .where(eq(tables.users.id, user.id))
    .get();
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    return NextResponse.json({ error: "رمز عبور فعلی اشتباه است" }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);
  db.update(tables.users).set({ passwordHash }).where(eq(tables.users.id, user.id)).run();

  // sign out every other device: delete all sessions except the current one
  const jar = await cookies();
  const currentToken = jar.get(SESSION_COOKIE)?.value ?? "";
  db.delete(tables.sessions)
    .where(and(eq(tables.sessions.userId, user.id), ne(tables.sessions.id, currentToken)))
    .run();

  return NextResponse.json({ ok: true });
}
