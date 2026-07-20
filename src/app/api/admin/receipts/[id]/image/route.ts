import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth-server";
import { receiptAbsPath } from "@/lib/receipts";
import fs from "fs/promises";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/admin/receipts/[id]/image">) {
  const admin = await currentUser();
  if (!admin || admin.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await ctx.params;
  const receipt = db
    .select({ imagePath: tables.receipts.imagePath })
    .from(tables.receipts)
    .where(eq(tables.receipts.id, Number(id)))
    .get();
  if (!receipt) return new NextResponse("Not found", { status: 404 });

  try {
    const buf = await fs.readFile(receiptAbsPath(receipt.imagePath));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
