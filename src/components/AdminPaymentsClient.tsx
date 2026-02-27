"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

type PaymentItem = {
  id: string;
  status: string;
  amountCents: number;
  asaasId: string;
  package: { name: string; subject?: { name: string } | null };
  user: { name: string };
};

type SubscriptionItem = {
  id: string;
  status: string;
  nextDueDate?: string | null;
  package: { name: string; subject?: { name: string } | null };
  user: { name: string };
};

const OPEN_PAYMENT_STATUSES = new Set(["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"]);

export default function AdminPaymentsClient({
  payments,
  subscriptions
}: {
  payments: PaymentItem[];
  subscriptions: SubscriptionItem[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [loadingPaymentId, setLoadingPaymentId] = useState<string | null>(null);
  const [loadingSubscriptionId, setLoadingSubscriptionId] = useState<string | null>(null);

  async function cancelPayment(paymentId: string) {
    setLoadingPaymentId(paymentId);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/cancel`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data?.message ?? "Não foi possível cancelar o pagamento.");
        setLoadingPaymentId(null);
        return;
      }
      setMessage(data?.message ?? "Pagamento cancelado com sucesso.");
      window.location.reload();
    } catch {
      setMessage("Falha de conexão ao cancelar pagamento.");
      setLoadingPaymentId(null);
    }
  }

  async function cancelSubscription(subscriptionId: string) {
    setLoadingSubscriptionId(subscriptionId);
    setMessage(null);
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data?.message ?? "Não foi possível cancelar a assinatura.");
        setLoadingSubscriptionId(null);
        return;
      }
      setMessage(data?.message ?? "Assinatura cancelada com sucesso.");
      window.location.reload();
    } catch {
      setMessage("Falha de conexão ao cancelar assinatura.");
      setLoadingSubscriptionId(null);
    }
  }

  return (
    <div className="space-y-6">
      {message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Pagamentos recentes</h2>
        <div className="mt-3 grid gap-2 text-sm">
          {payments.length === 0 ? (
            <p className="text-slate-500">Nenhum pagamento registrado.</p>
          ) : (
            payments.map((payment) => {
              const canCancel = OPEN_PAYMENT_STATUSES.has(payment.status);
              return (
                <div key={payment.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="font-semibold text-slate-900">{payment.user.name}</p>
                  <p className="text-xs text-slate-500">
                    {payment.package.name} • {payment.package.subject?.name ?? "Disciplina"} • {payment.status}
                  </p>
                  <p className="text-xs text-slate-500">{formatCurrency(payment.amountCents)}</p>
                  <p className="text-[11px] text-slate-400">Asaas: {payment.asaasId}</p>
                  <div className="mt-2">
                    <button
                      type="button"
                      disabled={!canCancel || loadingPaymentId === payment.id}
                      onClick={() => cancelPayment(payment.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      title={!canCancel ? "Somente pagamentos pendentes/vencidos podem ser cancelados." : undefined}
                    >
                      {loadingPaymentId === payment.id ? "Cancelando..." : "Cancelar pagamento"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Assinaturas</h2>
        <div className="mt-3 grid gap-2 text-sm">
          {subscriptions.length === 0 ? (
            <p className="text-slate-500">Nenhuma assinatura registrada.</p>
          ) : (
            subscriptions.map((subscription) => {
              const canCancel = subscription.status !== "CANCELED";
              return (
                <div key={subscription.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="font-semibold text-slate-900">{subscription.user.name}</p>
                  <p className="text-xs text-slate-500">
                    {subscription.package.name} • {subscription.package.subject?.name ?? "Disciplina"} • {subscription.status}
                  </p>
                  {subscription.nextDueDate && (
                    <p className="text-xs text-slate-500">
                      Próxima cobrança: {new Date(subscription.nextDueDate).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  <div className="mt-2">
                    <button
                      type="button"
                      disabled={!canCancel || loadingSubscriptionId === subscription.id}
                      onClick={() => cancelSubscription(subscription.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingSubscriptionId === subscription.id ? "Cancelando..." : "Cancelar assinatura"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
