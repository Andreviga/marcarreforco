import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBalancesForStudent } from "@/lib/credits";
import AppShell from "@/components/AppShell";
import StudentPaymentsClient from "@/components/StudentPaymentsClient";

export default async function AlunoPagamentosPage() {
  const session = await requireRole(["ALUNO"]);

  const [packages, balances, subscriptions, profile, subjects, pendingPayments] = await Promise.all([
    prisma.sessionPackage.findMany({
      where: { active: true },
      include: { subject: true },
      orderBy: { createdAt: "desc" }
    }),
    getBalancesForStudent(session.user.id),
    prisma.asaasSubscription.findMany({
      where: { userId: session.user.id },
      include: { package: { include: { subject: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.studentProfile.findUnique({ where: { userId: session.user.id } }),
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
