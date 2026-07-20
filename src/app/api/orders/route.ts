import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-server";
import { createOrder } from "@/lib/orders";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.banned) {
    return NextResponse.json({ error: "ابتدا وارد حساب خود شوید" }, { status: 401 });
  }
  const { planId } = await req.json().catch(() => ({}));
  if (!Number.isInteger(planId)) {
    return NextResponse.json({ error: "پلن نامعتبر" }, { status: 400 });
  }
  try {
    const order = createOrder(user.id, planId);
    return NextResponse.json({ ok: true, publicId: order.publicId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
