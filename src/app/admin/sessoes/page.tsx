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
    include: { subject: true, teacher: true },
    orderBy: { startsAt: "asc" }
  });
  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });
  const teachers = await prisma.user.findMany({
    where: { role: "PROFESSOR" },
    orderBy: { name: "asc" }
  });

  const calendarItems = sessions.map((item) => ({
    id: item.id,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    title: item.subject.name,
    subtitle: item.teacher.name,
    meta: `${formatCurrency(item.priceCents)} • ${item.status}`,
    status: item.status
  }));

  return (
    <AppShell title="Sessões" subtitle="Crie e gerencie sessões de reforço" role="ADMIN">
      <div className="space-y-6">
        <MonthlyCalendarClient month={month} year={year} items={calendarItems} />
        <AdminSessionsClient sessions={sessions} subjects={subjects} teachers={teachers} />
      </div>
    </AppShell>
  );
}
