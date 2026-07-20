import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-server";
import { getXui } from "@/lib/xui";

export async function POST() {
  const admin = await currentUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  try {
    const inbounds = await getXui().listInbounds();
    return NextResponse.json({
      ok: true,
      inbounds: inbounds.length,
      list: inbounds.map((i) => `#${i.id} ${i.remark} (${i.protocol}:${i.port})`).join("، "),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
