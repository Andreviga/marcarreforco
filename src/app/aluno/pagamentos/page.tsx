import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBalancesForStudent } from "@/lib/credits";
import AppShell from "@/components/AppShell";
import StudentPaymentsClient from "@/components/StudentPaymentsClient";

export default async function AlunoPagamentosPage() {
  const session = await requireRole(["ALUNO"]);

  const [packages, balances, profile, subjects, pendingPayments] = await Promise.all([
    prisma.sessionPackage.findMany({
      where: { active: true, billingType: "PACKAGE" },
      include: { subject: true },
      orderBy: { createdAt: "desc" }
    }),
    getBalancesForStudent(session.user.id),
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
    <AppShell title="Pagamentos" subtitle="Compre pacotes e pague via PIX" role="ALUNO">
      <StudentPaymentsClient
        packages={packages}
        balances={balances.map((item) => ({
          subject: { id: item.subject.id, name: item.subject.name },
          balance: item.balance
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
