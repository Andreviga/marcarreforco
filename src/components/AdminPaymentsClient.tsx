"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface PackageInfo {
  id: string;
  name: string;
  subject: { name: string } | null;
}

interface PaymentItem {
  id: string;
  asaasId: string;
  status: string;
  amountCents: number;
  billingType: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  user: UserInfo;
  package: PackageInfo;
}

interface SubscriptionItem {
  id: string;
  asaasId: string;
  status: string;
  nextDueDate: string | null;
  createdAt: string;
  user: UserInfo;
  package: PackageInfo;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  payloadJson: Record<string, unknown>;
  createdAt: string;
  actor: UserInfo;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Ativa", className: "bg-emerald-100 text-emerald-700" },
  INACTIVE: { label: "Aguardando pagamento", className: "bg-amber-100 text-amber-700" },
  CANCELED: { label: "Cancelada", className: "bg-red-100 text-red-700" },
  OVERDUE: { label: "Vencida", className: "bg-orange-100 text-orange-700" },
  CONFIRMED: { label: "Confirmado", className: "bg-emerald-100 text-emerald-700" },
  PENDING: { label: "Pendente", className: "bg-amber-100 text-amber-700" },
  REFUNDED: { label: "Estornado", className: "bg-purple-100 text-purple-700" },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_LABELS[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CANCEL_SUBSCRIPTION: "Cancelamento de assinatura",
  };
  return labels[action] ?? action;
}

export default function AdminPaymentsClient({
  payments,
  subscriptions,
  auditLogs,
}: {
  payments: PaymentItem[];
  subscriptions: SubscriptionItem[];
  auditLogs: AuditLogItem[];
}) {
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localSubscriptions, setLocalSubscriptions] = useState(subscriptions);
  const [activeTab, setActiveTab] = useState<"pagamentos" | "assinaturas" | "logs">("assinaturas");

  async function handleAdminCancel(subscriptionId: string, userName: string) {
    if (!confirm(`Confirmar cancelamento da assinatura de ${userName}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setCancelingId(subscriptionId);
    setMessage(null);

    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(`Erro: ${data?.message ?? "Falha ao cancelar assinatura."}`);
        return;
      }

      setMessage(data?.message ?? "✅ Assinatura cancelada com sucesso!");

      // Atualizar status localmente sem recarregar a página
      setLocalSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === subscriptionId ? { ...sub, status: "CANCELED" } : sub
        )
      );
    } catch {
      setMessage("Falha ao cancelar assinatura. Verifique sua conexão.");
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`rounded-lg border p-3 text-sm ${message.startsWith("Erro") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(["assinaturas", "pagamentos", "logs"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {tab === "assinaturas" && `Assinaturas (${localSubscriptions.length})`}
            {tab === "pagamentos" && `Pagamentos (${payments.length})`}
            {tab === "logs" && `Logs de auditoria (${auditLogs.length})`}
          </button>
        ))}
      </div>

      {/* ASSINATURAS */}
      {activeTab === "assinaturas" && (
        <div className="rounded-xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">Assinaturas</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {localSubscriptions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Nenhuma assinatura registrada.</p>
            ) : (
              localSubscriptions.map((sub) => (
                <div key={sub.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{sub.user.name}</p>
                    <p className="text-xs text-slate-500">{sub.user.email}</p>
                    <p className="text-xs text-slate-500">
                      {sub.package.name}
                      {sub.package.subject ? ` • ${sub.package.subject.name}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <StatusBadge status={sub.status} />
                      {sub.nextDueDate && (
                        <span>Próxima cobrança: {formatDate(sub.nextDueDate)}</span>
                      )}
                      <span>Criada: {formatDate(sub.createdAt)}</span>
                    </div>
                  </div>
                  {(sub.status === "ACTIVE" || sub.status === "INACTIVE") && (
                    <button
                      type="button"
                      onClick={() => handleAdminCancel(sub.id, sub.user.name)}
                      disabled={cancelingId === sub.id}
                      className="shrink-0 self-start rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 sm:self-auto"
                    >
                      {cancelingId === sub.id ? "Cancelando..." : "Cancelar assinatura"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PAGAMENTOS */}
      {activeTab === "pagamentos" && (
        <div className="rounded-xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">Pagamentos recentes</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Nenhum pagamento registrado.</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="px-4 py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{payment.user.name}</p>
                      <p className="text-xs text-slate-500">{payment.user.email}</p>
                      <p className="text-xs text-slate-500">
                        {payment.package.name}
                        {payment.package.subject ? ` • ${payment.package.subject.name}` : ""}
                        {" • "}
                        {payment.billingType}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-slate-700">
                        {formatCurrency(payment.amountCents)}
                      </span>
                      <StatusBadge status={payment.status} />
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                    {payment.dueDate && <span>Vencimento: {formatDate(payment.dueDate)}</span>}
                    {payment.paidAt && <span>Pago em: {formatDate(payment.paidAt)}</span>}
                    <span>Criado: {formatDate(payment.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* LOGS DE AUDITORIA */}
      {activeTab === "logs" && (
        <div className="rounded-xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">Logs de auditoria</h2>
            <p className="text-xs text-slate-500">Registro de ações sobre assinaturas e pagamentos</p>
          </div>
          <div className="divide-y divide-slate-50">
            {auditLogs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Nenhuma ação registrada.</p>
            ) : (
              auditLogs.map((log) => {
                const payload = log.payloadJson as {
                  packageName?: string;
                  subscriptionId?: string;
                };
                return (
                  <div key={log.id} className="px-4 py-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {formatActionLabel(log.action)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Por: {log.actor.name} ({log.actor.email})
                        </p>
                        {payload.packageName && (
                          <p className="text-xs text-slate-500">Pacote: {payload.packageName}</p>
                        )}
                        <p className="text-xs text-slate-400">
                          Entidade: {log.entityType} #{log.entityId.slice(-8)}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
