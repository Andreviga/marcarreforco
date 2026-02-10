import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TicketsClient from "@/components/TicketsClient";

export default async function AlunoTicketsPage() {
  const session = await requireRole(["ALUNO"]);

  const tickets = await prisma.ticket.findMany({
    where: { studentId: session.user.id },
    include: {
      student: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { messages: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  const teachers = await prisma.user.findMany({
    where: { role: "PROFESSOR" },
    orderBy: { name: "asc" }
  });

  return (
    <AppShell title="Tickets" subtitle="Envie dúvidas e acompanhe respostas" role="ALUNO">
      <TicketsClient role="ALUNO" tickets={tickets} teachers={teachers} basePath="/aluno/tickets" />
    </AppShell>
  );
}
