import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const admin = await currentUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const userId = Number(id);
  const { action, minutes } = await req.json().catch(() => ({}));

  const target = db.select().from(tables.users).where(eq(tables.users.id, userId)).get();
  if (!target) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  if (target.role === "admin") {
    return NextResponse.json({ error: "امکان تغییر مدیر وجود ندارد" }, { status: 400 });
  }

  if (action === "ban") {
    db.update(tables.users).set({ banned: true }).where(eq(tables.users.id, userId)).run();
    // kill their sessions
    db.delete(tables.sessions).where(eq(tables.sessions.userId, userId)).run();
  } else if (action === "unban") {
    db.update(tables.users).set({ banned: false }).where(eq(tables.users.id, userId)).run();
  } else if (action === "mute") {
    db.update(tables.users)
      .set({ chatMutedUntil: Date.now() + (Number(minutes) || 60) * 60_000 })
      .where(eq(tables.users.id, userId))
      .run();
  } else {
    return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
  }

  db.insert(tables.auditLog)
    .values({ actorId: admin.id, action: `user.${action}`, target: `user:${userId}` })
    .run();
  return NextResponse.json({ ok: true });
}
