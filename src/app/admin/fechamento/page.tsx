import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminFechamentoClient from "@/components/AdminFechamentoClient";

export default async function AdminFechamentoPage() {
  await requireRole(["ADMIN"]);

  const invoices = await prisma.invoice.findMany({
    include: { student: true },
    orderBy: { createdAt: "desc" }
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
