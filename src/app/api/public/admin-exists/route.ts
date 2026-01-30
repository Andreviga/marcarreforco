import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  return NextResponse.json({ exists: Boolean(admin) });
}
