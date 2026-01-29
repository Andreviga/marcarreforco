import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AgendaClient from "@/components/AgendaClient";

export default async function AlunoAgendaPage() {
  const session = await requireRole(["ALUNO"]);

  const sessions = await prisma.session.findMany({
    where: { status: "ATIVA" },
    include: { subject: true, teacher: true },
    orderBy: { startsAt: "asc" }
  });

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: session.user.id },
    include: { session: true }
  });

  return (
    <AppShell
      title="Agenda de reforços"
      subtitle="Escolha e agende suas sessões"
      role="ALUNO"
    >
      <AgendaClient sessions={sessions} enrollments={enrollments} />
    </AppShell>
  );
}
