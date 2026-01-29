import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { invoiceGenerateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { startOfMonth, endOfMonth } from "date-fns";

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = invoiceGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const { month, year } = parsed.data;
  const periodStart = startOfMonth(new Date(year, month - 1, 1));
  const periodEnd = endOfMonth(new Date(year, month - 1, 1));

  const attendances = await prisma.attendance.findMany({
    where: {
      markedAt: {
        gte: periodStart,
        lte: periodEnd
      },
      status: { in: ["PRESENTE", "ATRASADO"] },
      session: { status: "ATIVA" },
      enrollment: { status: "AGENDADO" }
    },
    include: {
      session: { include: { subject: true, teacher: true } },
      student: true
    }
  });

  const byStudent = new Map<string, typeof attendances>();
  for (const attendance of attendances) {
    const list = byStudent.get(attendance.studentId) ?? [];
    list.push(attendance);
    byStudent.set(attendance.studentId, list);
  }

  const createdInvoices: string[] = [];

  for (const [studentId, items] of byStudent.entries()) {
    const existingInvoice = await prisma.invoice.findUnique({
      where: { studentId_month_year: { studentId, month, year } }
    });

    if (existingInvoice?.status === "PAGA") {
      continue;
    }

    const totalCents = items.reduce((sum, attendance) => sum + attendance.session.priceCents, 0);

    const invoice = await prisma.invoice.upsert({
      where: { studentId_month_year: { studentId, month, year } },
      update: { totalCents, status: existingInvoice?.status ?? "ABERTA" },
      create: {
        studentId,
        month,
        year,
        status: "ABERTA",
        totalCents
      }
    });

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

    await prisma.invoiceItem.createMany({
      data: items.map((attendance) => ({
        invoiceId: invoice.id,
        sessionId: attendance.sessionId,
        attendanceId: attendance.id,
        description: `${attendance.session.subject.name} - ${attendance.session.teacher.name}`,
        occurredAt: attendance.session.startsAt,
        amountCents: attendance.session.priceCents
      }))
    });

    await logAudit({
      actorUserId: session.user.id,
      action: "GENERATE_INVOICE",
      entityType: "Invoice",
      entityId: invoice.id,
      payload: { studentId, month, year, totalCents }
    });

    createdInvoices.push(invoice.id);
  }

  return NextResponse.json({ invoices: createdInvoices });
}
