import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminSessionsClient from "@/components/AdminSessionsClient";
import MonthlyCalendarClient from "@/components/MonthlyCalendarClient";
import { formatCurrency } from "@/lib/format";

export default async function AdminSessoesPage() {
  await requireRole(["ADMIN"]);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const sessions = await prisma.session.findMany({
    include: {
      subject: true,
      teacher: true,
      enrollments: {
        where: { status: "AGENDADO" },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { startsAt: "asc" }
  });
  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });
  const teachers = await prisma.user.findMany({
    where: { role: "PROFESSOR" },
    orderBy: { name: "asc" }
  });
  const students = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true }
  });

  const calendarItems = sessions.map((item) => ({
    id: item.id,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    title: item.subject.name,
    subtitle: item.teacher.name,
    meta: item.priceCents > 0 ? `${formatCurrency(item.priceCents)} • ${item.status}` : `${item.status}`,
    status: item.status,
    hasEnrollments: item.enrollments.length > 0
  }));

  return (
    <AppShell title="Sessões" subtitle="Crie e gerencie sessões de reforço" role="ADMIN">
      <div className="space-y-6">
        <MonthlyCalendarClient month={month} year={year} items={calendarItems} />
        <AdminSessionsClient sessions={sessions} subjects={subjects} teachers={teachers} students={students} />
      </div>
    </AppShell>
  );
}
