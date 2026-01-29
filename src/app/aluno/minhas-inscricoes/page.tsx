import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import InscricoesClient from "@/components/InscricoesClient";

export default async function MinhasInscricoesPage() {
  const session = await requireRole(["ALUNO"]);

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: session.user.id },
    include: { session: { include: { subject: true, teacher: true } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppShell title="Minhas inscrições" subtitle="Acompanhe seus agendamentos" role="ALUNO">
      <InscricoesClient enrollments={enrollments} />
    </AppShell>
  );
}
