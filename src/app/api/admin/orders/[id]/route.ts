import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-server";
import { revokeOrder, unrevokeOrder } from "@/lib/orders";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/orders/[id]">) {
  const admin = await currentUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { action, reason } = await req.json().catch(() => ({}));
  try {
    if (action === "revoke") {
      await revokeOrder(Number(id), admin.id, String(reason ?? "لغو توسط مدیر"));
    } else if (action === "unrevoke") {
      await unrevokeOrder(Number(id), admin.id);
    } else {
      return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
