import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import { formatCurrency } from "@/lib/format";

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
      <div className="space-y-6">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Pagamentos recentes</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {payments.length === 0 ? (
              <p className="text-slate-500">Nenhum pagamento registrado.</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="font-semibold text-slate-900">{payment.user.name}</p>
                  <p className="text-xs text-slate-500">
                    {payment.package.name} • {payment.package.subject?.name ?? "Disciplina"} • {payment.status}
                  </p>
                  <p className="text-xs text-slate-500">{formatCurrency(payment.amountCents)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Assinaturas</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {subscriptions.length === 0 ? (
              <p className="text-slate-500">Nenhuma assinatura registrada.</p>
            ) : (
              subscriptions.map((subscription) => (
                <div key={subscription.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="font-semibold text-slate-900">{subscription.user.name}</p>
                  <p className="text-xs text-slate-500">
                    {subscription.package.name} • {subscription.package.subject?.name ?? "Disciplina"} • {subscription.status}
                  </p>
                  {subscription.nextDueDate && (
                    <p className="text-xs text-slate-500">
                      Proxima cobranca: {subscription.nextDueDate.toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
