import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TicketsClient from "@/components/TicketsClient";

export default async function ProfessorTicketsPage() {
  const session = await requireRole(["PROFESSOR"]);

  const tickets = await prisma.ticket.findMany({
    where: { teacherId: session.user.id },
    include: {
      student: { select: { id: true, name: true, studentProfile: { select: { studentName: true } } } },
      teacher: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { messages: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  const studentRows = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, studentProfile: { select: { studentName: true } } }
  });
  // Professores enxergam o nome do aluno, não o do responsável (dono da conta).
  const students = studentRows
    .map((user) => ({ id: user.id, name: user.studentProfile?.studentName ?? user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <AppShell title="Tickets" subtitle="Registre melhorias e responda alunos" role="PROFESSOR">
      <TicketsClient
        role="PROFESSOR"
        tickets={tickets.map((ticket) => ({
          ...ticket,
          student: ticket.student
            ? { id: ticket.student.id, name: ticket.student.studentProfile?.studentName ?? ticket.student.name }
            : ticket.student
        }))}
        students={students}
        basePath="/professor/tickets"
      />
    </AppShell>
  );
}
