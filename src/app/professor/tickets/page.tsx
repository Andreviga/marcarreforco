import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TicketsClient from "@/components/TicketsClient";

export default async function ProfessorTicketsPage() {
  const session = await requireRole(["PROFESSOR"]);

  const tickets = await prisma.ticket.findMany({
    where: { teacherId: session.user.id },
    include: {
      student: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { messages: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  const students = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: { name: "asc" }
  });

  return (
    <AppShell title="Tickets" subtitle="Registre melhorias e responda alunos" role="PROFESSOR">
      <TicketsClient role="PROFESSOR" tickets={tickets} students={students} basePath="/professor/tickets" />
    </AppShell>
  );
}
