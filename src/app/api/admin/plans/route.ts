import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";

async function guard() {
  const admin = await currentUser();
  if (!admin || admin.role !== "admin") return null;
  return admin;
}

export async function POST(req: NextRequest) {
  const admin = await guard();
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const values = {
    name: String(body.name ?? "").slice(0, 80),
    days: Math.max(1, Number(body.days) || 30),
    gb: Math.max(0, Number(body.gb) || 0),
    limitIp: Math.max(0, Number(body.limitIp) || 0),
    priceToman: Math.max(1000, Number(body.priceToman) || 0),
    inboundId: Math.max(1, Number(body.inboundId) || 1),
    description: String(body.description ?? "").slice(0, 200) || null,
    sortOrder: Number(body.sortOrder) || 0,
    active: Boolean(body.active),
  };
  if (!values.name) return NextResponse.json({ error: "نام پلن الزامی است" }, { status: 400 });

  if (body.id) {
    db.update(tables.plans).set(values).where(eq(tables.plans.id, Number(body.id))).run();
  } else {
    db.insert(tables.plans).values(values).run();
  }
  db.insert(tables.auditLog)
    .values({ actorId: admin.id, action: "plan.save", detail: JSON.stringify(values) })
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await guard();
  if (!admin) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  // soft-disable instead of hard delete if orders reference it
  try {
    db.delete(tables.plans).where(eq(tables.plans.id, Number(id))).run();
  } catch {
    db.update(tables.plans).set({ active: false }).where(eq(tables.plans.id, Number(id))).run();
  }
  return NextResponse.json({ ok: true });
}
