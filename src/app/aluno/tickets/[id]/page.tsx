import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TicketDetailClient from "@/components/TicketDetailClient";

export default async function AlunoTicketDetailPage({ params }: { params: { id: string } }) {
  const session = await requireRole(["ALUNO"]);

  const ticket = await prisma.ticket.findFirst({
    where: { id: params.id, studentId: session.user.id },
    include: {
      student: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      messages: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!ticket) {
    redirect("/aluno/tickets");
  }

  return (
    <AppShell title="Ticket" subtitle="Detalhes e mensagens" role="ALUNO">
      <TicketDetailClient ticket={ticket} role="ALUNO" />
    </AppShell>
  );
}
