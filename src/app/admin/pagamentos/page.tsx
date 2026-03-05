import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminPaymentsClient from "@/components/AdminPaymentsClient";

export default async function AdminPagamentosPage() {
  await requireRole(["ADMIN"]);

  const [payments, subscriptions] = await Promise.all([
    prisma.asaasPayment.findMany({
      include: { user: true, package: { include: { subject: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.asaasSubscription.findMany({
      include: { user: true, package: { include: { subject: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);

  return (
    <AppShell title="Pagamentos" subtitle="Acompanhe cobrancas e assinaturas" role="ADMIN">
      <AdminPaymentsClient
        payments={payments.map((payment) => ({
          ...payment,
          dueDate: payment.dueDate?.toISOString() ?? null,
          paidAt: payment.paidAt?.toISOString() ?? null,
          createdAt: payment.createdAt.toISOString()
        }))}
        subscriptions={subscriptions.map((subscription) => ({
          ...subscription,
          nextDueDate: subscription.nextDueDate?.toISOString() ?? null,
          createdAt: subscription.createdAt.toISOString(),
          updatedAt: subscription.updatedAt.toISOString()
        }))}
      />
    </AppShell>
  );
}
