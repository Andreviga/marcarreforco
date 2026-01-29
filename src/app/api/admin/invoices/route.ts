import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const invoices = await prisma.invoice.findMany({
    where: {
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined
    },
    include: { student: true, items: true },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ invoices });
}

export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const id = body?.id as string | undefined;
  const status = body?.status as string | undefined;

  const allowedStatuses = ["ABERTA", "EMITIDA", "PAGA"] as const;

  if (!id || !status || !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: status as (typeof allowedStatuses)[number] }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "UPDATE_INVOICE_STATUS",
    entityType: "Invoice",
    entityId: updated.id,
    payload: { status }
  });

  return NextResponse.json({ invoice: updated });
}
