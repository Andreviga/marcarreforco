import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBalancesForStudent } from "@/lib/credits";
import { isPackageEligibleForSerie } from "@/lib/validators";
import AppShell from "@/components/AppShell";
import StudentPaymentsClient from "@/components/StudentPaymentsClient";

export default async function AlunoPagamentosPage() {
  const session = await requireRole(["ALUNO"]);

  // Buscar perfil do aluno para filtrar por série
  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });

  // Buscar disciplinas de sessões ativas para filtrar pacotes
  const activeSessions = await prisma.session.findMany({
    where: { status: "ATIVA" },
    select: { subjectId: true },
    distinct: ["subjectId"]
  });
  const activeSubjectIds = activeSessions.map((s) => s.subjectId);

  const [allPackages, balances, subscriptions, subjects, pendingPayments] = await Promise.all([
    prisma.sessionPackage.findMany({
      where: {
        active: true,
        OR: [
          { subjectId: null }, // Pacotes sem disciplina específica
          { subjectId: { in: activeSubjectIds } } // Pacotes de disciplinas com sessões ativas
        ]
      },
      include: { subject: true },
      orderBy: { createdAt: "desc" }
    }),
    getBalancesForStudent(session.user.id),
    prisma.asaasSubscription.findMany({
      where: { 
        userId: session.user.id,
        status: { not: "CANCELED" } // Não mostrar assinaturas canceladas
      },
      include: { package: { include: { subject: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    prisma.asaasPayment.findMany({
      where: {
        userId: session.user.id,
        status: "CONFIRMED",
        package: { subjectId: null },
        creditLedger: { none: { reason: "PAYMENT_CREDIT" } }
      },
      include: { package: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  // Filtrar pacotes pela série do aluno
  const packages = allPackages.filter((pkg) => isPackageEligibleForSerie(pkg.name, profile?.serie));

  return (
    <AppShell title="Pagamentos" subtitle="Assine planos e compre pacotes" role="ALUNO">
      <StudentPaymentsClient
        packages={packages}
        balances={balances.map((item) => ({
          subject: { id: item.subject.id, name: item.subject.name },
          balance: item.balance
        }))}
        subscriptions={subscriptions.map((item) => ({
          id: item.id,
          status: item.status,
          nextDueDate: item.nextDueDate ? item.nextDueDate.toISOString() : null,
          package: {
            id: item.package.id,
            name: item.package.name,
            sessionCount: item.package.sessionCount,
            priceCents: item.package.priceCents,
            billingType: item.package.billingType,
            billingCycle: item.package.billingCycle,
            subject: item.package.subject ? { id: item.package.subject.id, name: item.package.subject.name } : null
          }
        }))}
        subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
        pendingCredits={pendingPayments.map((payment) => ({
          id: payment.id,
          createdAt: payment.createdAt.toISOString(),
          package: {
            name: payment.package.name,
            sessionCount: payment.package.sessionCount
          }
        }))}
        document={profile?.document ?? null}
      />
    </AppShell>
  );
}
