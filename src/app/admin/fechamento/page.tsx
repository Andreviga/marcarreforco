import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus, Prisma } from "@prisma/client";
import AppShell from "@/components/AppShell";
import AdminFechamentoClient from "@/components/AdminFechamentoClient";

const allowedInvoiceStatuses = new Set<InvoiceStatus>(["ABERTA", "EMITIDA", "PAGA"]);

export default async function AdminFechamentoPage({
  searchParams
}: {
  searchParams?: { month?: string; year?: string; status?: string; studentId?: string; page?: string };
}) {
  await requireRole(["ADMIN"]);

  const now = new Date();
  const monthParam = Number(searchParams?.month);
  const yearParam = Number(searchParams?.year);
  const month = monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;
  const year = yearParam >= 2020 ? yearParam : now.getFullYear();
  const statusFilter =
    typeof searchParams?.status === "string" && allowedInvoiceStatuses.has(searchParams.status as InvoiceStatus)
      ? (searchParams.status as InvoiceStatus)
      : "TODAS";
  const studentId = typeof searchParams?.studentId === "string" ? searchParams.studentId : "";
  const page = Number(searchParams?.page) || 1;
  const pageSize = 10;

  const invoiceFilters: Prisma.InvoiceWhereInput = {
    ...(month ? { month } : {}),
    ...(year ? { year } : {}),
    ...(statusFilter !== "TODAS" ? { status: statusFilter } : {}),
    ...(studentId ? { studentId } : {})
  };

  const [invoices, invoiceCount] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceFilters,
      include: { student: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.invoice.count({ where: invoiceFilters })
  ]);

  const students = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: { name: "asc" }
  });

  const attendances = await prisma.attendance.findMany({
    where: {
      status: { in: ["PRESENTE", "ATRASADO"] },
      session: { status: "ATIVA" }
    },
    include: {
      session: { include: { subject: true, teacher: true } },
      student: true
    }
  });

  const reports = {
    totalByStudent: new Map<string, { name: string; total: number }>(),
    totalBySubject: new Map<string, { name: string; total: number }>(),
    totalByTeacher: new Map<string, { name: string; total: number }>(),
    totalByMonth: new Map<string, { label: string; total: number }>(),
    presenceRanking: new Map<string, { name: string; count: number }>()
  };

  for (const attendance of attendances) {
    const amount = attendance.session.priceCents;

    const studentEntry = reports.totalByStudent.get(attendance.studentId) ?? {
      name: attendance.student.name,
      total: 0
    };
    studentEntry.total += amount;
    reports.totalByStudent.set(attendance.studentId, studentEntry);

    const subjectEntry = reports.totalBySubject.get(attendance.session.subjectId) ?? {
      name: attendance.session.subject.name,
      total: 0
    };
    subjectEntry.total += amount;
    reports.totalBySubject.set(attendance.session.subjectId, subjectEntry);

    const teacherEntry = reports.totalByTeacher.get(attendance.session.teacherId) ?? {
      name: attendance.session.teacher.name,
      total: 0
    };
    teacherEntry.total += amount;
    reports.totalByTeacher.set(attendance.session.teacherId, teacherEntry);

    const monthKey = `${attendance.session.startsAt.getFullYear()}-${attendance.session.startsAt.getMonth() + 1}`;
    const monthEntry = reports.totalByMonth.get(monthKey) ?? {
      label: `${attendance.session.startsAt.getMonth() + 1}/${attendance.session.startsAt.getFullYear()}`,
      total: 0
    };
    monthEntry.total += amount;
    reports.totalByMonth.set(monthKey, monthEntry);

    const rankEntry = reports.presenceRanking.get(attendance.studentId) ?? {
      name: attendance.student.name,
      count: 0
    };
    rankEntry.count += 1;
    reports.presenceRanking.set(attendance.studentId, rankEntry);
  }

  return (
    <AppShell title="Fechamento do mês" subtitle="Gere faturas e acompanhe o faturamento" role="ADMIN">
      <AdminFechamentoClient
        invoices={invoices}
        students={students.map((student) => ({ id: student.id, name: student.name }))}
        filters={{
          month,
          year,
          status: statusFilter,
          studentId,
          page,
          pageSize,
          total: invoiceCount
        }}
        reports={{
          totalByStudent: Array.from(reports.totalByStudent.values()),
          totalBySubject: Array.from(reports.totalBySubject.values()),
          totalByTeacher: Array.from(reports.totalByTeacher.values()),
          totalByMonth: Array.from(reports.totalByMonth.values()),
          presenceRanking: Array.from(reports.presenceRanking.values())
        }}
      />
    </AppShell>
  );
}
