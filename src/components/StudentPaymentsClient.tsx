"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

interface SubjectOption {
  id: string;
  name: string;
}

interface PackageItem {
  id: string;
  name: string;
  sessionCount: number;
  priceCents: number;
  billingType: "PACKAGE" | "SUBSCRIPTION";
  billingCycle: "MONTHLY" | "WEEKLY" | null;
  subject: SubjectOption | null;
}

interface BalanceItem {
  subject: SubjectOption;
  balance: number;
}

interface SubscriptionItem {
  id: string;
  status: string;
  nextDueDate: string | null;
  package: PackageItem;
}

export default function StudentPaymentsClient({
  packages,
  balances,
  subscriptions,
  document
}: {
  packages: PackageItem[];
  balances: BalanceItem[];
  subscriptions: SubscriptionItem[];
  document: string | null;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "BOLETO">("PIX");
  const [docValue, setDocValue] = useState(document ?? "");
  const [docError, setDocError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasDocument, setHasDocument] = useState(Boolean(document));

  const subscriptionMap = useMemo(() => {
    return new Map(subscriptions.map((sub) => [sub.package.id, sub]));
  }, [subscriptions]);

  async function handleDocumentSave() {
    setDocError(null);
    const response = await fetch("/api/profile/document", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: docValue })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setDocError(data?.message ?? "Nao foi possivel salvar.");
      return;
    }

    setHasDocument(true);
    setMessage("Documento salvo. Agora voce ja pode pagar.");
  }

  async function handleCheckout(packageId: string) {
    setLoadingId(packageId);
    setMessage(null);

    const response = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId, billingType: paymentMethod })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data?.message ?? "Falha ao iniciar pagamento.");
      setLoadingId(null);
      return;
    }

    const data = await response.json();
    setLoadingId(null);

    if (data?.paymentUrl) {
      window.open(data.paymentUrl, "_blank");
      setMessage("Pagamento criado. Finalize na nova aba.");
      return;
    }

    setMessage("Assinatura criada. Aguarde a cobranca.");
  }

  return (
    <div className="space-y-6">
      {!hasDocument && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-900">Complete seu CPF/CNPJ</h2>
          <p className="text-sm text-amber-700">Precisamos do documento para criar a cobranca no Asaas.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-[240px] flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="CPF ou CNPJ"
              value={docValue}
              onChange={(event) => setDocValue(event.target.value)}
            />
            <button
              type="button"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700"
              onClick={handleDocumentSave}
            >
              Salvar
            </button>
          </div>
          {docError && <p className="mt-2 text-sm text-rose-600">{docError}</p>}
        </div>
      )}

      {message && <p className="text-sm text-slate-600">{message}</p>}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Saldo de aulas</h2>
        <div className="mt-3 grid gap-2 text-sm">
          {balances.length === 0 ? (
            <p className="text-slate-500">Sem saldo ativo.</p>
          ) : (
            balances.map((item) => (
              <div key={item.subject.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span>{item.subject.name}</span>
                <span className="font-semibold text-slate-700">{item.balance} credito(s)</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Planos e pacotes</h2>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Forma de pagamento</span>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as "PIX" | "BOLETO")}
            >
              <option value="PIX">PIX</option>
              <option value="BOLETO">Boleto</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {packages.map((item) => {
            const subscription = subscriptionMap.get(item.id);
            return (
              <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{item.subject?.name ?? "Disciplina"}</p>
                    <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.billingType === "SUBSCRIPTION" ? "Assinatura" : "Pacote"} • {item.sessionCount} aula(s)
                      {item.billingType === "SUBSCRIPTION" && item.billingCycle
                        ? ` / ${item.billingCycle === "MONTHLY" ? "mes" : "semana"}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{formatCurrency(item.priceCents)}</span>
                    {subscription && item.billingType === "SUBSCRIPTION" ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                        {subscription.status === "ACTIVE" ? "Assinatura ativa" : "Assinatura pendente"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCheckout(item.id)}
                        disabled={loadingId === item.id || !hasDocument}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {loadingId === item.id ? "Processando..." : "Contratar"}
                      </button>
                    )}
                  </div>
                </div>
                {subscription?.nextDueDate && (
                  <p className="mt-2 text-xs text-slate-500">
                    Proxima cobranca: {new Date(subscription.nextDueDate).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
