import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  return NextResponse.json({ exists: Boolean(admin) });
}
