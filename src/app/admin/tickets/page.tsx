import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TicketsClient from "@/components/TicketsClient";

export default async function AdminTicketsPage() {
  await requireRole(["ADMIN"]);

  const tickets = await prisma.ticket.findMany({
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

  const students = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: { name: "asc" }
  });

  return (
    <AppShell title="Central de Dúvidas" subtitle="Acompanhe dúvidas e melhorias de toda a escola" role="ADMIN">
      <TicketsClient
        role="ADMIN"
        tickets={tickets}
        teachers={teachers}
        students={students}
        basePath="/admin/tickets"
      />
    </AppShell>
  );
}
