import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminSessionsClient from "@/components/AdminSessionsClient";

export default async function AdminSessoesPage() {
  await requireRole(["ADMIN"]);

  const sessions = await prisma.session.findMany({
    include: { subject: true, teacher: true },
    orderBy: { startsAt: "asc" }
  });
  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });
  const teachers = await prisma.user.findMany({
    where: { role: "PROFESSOR" },
    orderBy: { name: "asc" }
  });

  return (
    <AppShell title="Sessões" subtitle="Crie e gerencie sessões de reforço" role="ADMIN">
      <AdminSessionsClient sessions={sessions} subjects={subjects} teachers={teachers} />
    </AppShell>
  );
}
