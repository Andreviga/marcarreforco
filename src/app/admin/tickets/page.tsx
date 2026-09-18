import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TicketsClient from "@/components/TicketsClient";

export default async function AdminTicketsPage() {
  await requireRole(["ADMIN"]);

  const tickets = await prisma.ticket.findMany({
    include: {
      student: { select: { id: true, name: true, studentProfile: { select: { studentName: true } } } },
      teacher: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { messages: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  const teachers = await prisma.user.findMany({
    where: { role: "PROFESSOR" },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  const studentRows = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, studentProfile: { select: { studentName: true } } }
  });
  // Exibe o nome do aluno (a conta é do responsável).
  const students = studentRows
    .map((user) => ({ id: user.id, name: user.studentProfile?.studentName ?? user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <AppShell title="Tickets" subtitle="Controle total de dúvidas e melhorias" role="ADMIN">
      <TicketsClient
        role="ADMIN"
        tickets={tickets.map((ticket) => ({
          ...ticket,
          student: ticket.student
            ? { id: ticket.student.id, name: ticket.student.studentProfile?.studentName ?? ticket.student.name }
            : ticket.student
        }))}
        teachers={teachers}
        students={students}
        basePath="/admin/tickets"
      />
    </AppShell>
  );
}
