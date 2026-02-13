"use client";

import { useEffect, useMemo, useState } from "react";
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

interface PendingCreditItem {
  id: string;
  createdAt: string;
  package: { name: string; sessionCount: number };
}

export default function StudentPaymentsClient({
  packages,
  balances,
  subscriptions,
  subjects,
  pendingCredits,
  document
}: {
  packages: PackageItem[];
  balances: BalanceItem[];
  subscriptions: SubscriptionItem[];
  subjects: SubjectOption[];
  pendingCredits: PendingCreditItem[];
  document: string | null;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [docValue, setDocValue] = useState(document ?? "");
  const [docError, setDocError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasDocument, setHasDocument] = useState(Boolean(document));
  const [allocationId, setAllocationId] = useState<string | null>(null);
  const [allocationMessage, setAllocationMessage] = useState<string | null>(null);
  const [allocationSubject, setAllocationSubject] = useState<Record<string, string>>({});
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isChrome, setIsChrome] = useState(false);

  // Detectar se é Chrome
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const chrome = userAgent.includes("chrome") && !userAgent.includes("edg");
    setIsChrome(chrome);
  }, []);

  const subscriptionMap = useMemo(() => {
    return new Map(subscriptions.map((sub) => [sub.package.id, sub]));
  }, [subscriptions]);

  const filteredPackages = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return packages.filter((item) => {
      const subjectId = item.subject?.id ?? "none";
      if (subjectFilter !== "all" && subjectId !== subjectFilter) {
        return false;
      }
      if (!search) return true;
      const haystack = `${item.name} ${item.subject?.name ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [packages, searchTerm, subjectFilter]);

  const groupedPackages = useMemo(() => {
    const groups = new Map<string, { id: string; label: string; items: PackageItem[] }>();
    for (const item of filteredPackages) {
      const groupId = item.subject?.id ?? "none";
      const groupLabel = item.subject?.name ?? "Sem disciplina";
      const existing = groups.get(groupId);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(groupId, { id: groupId, label: groupLabel, items: [item] });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredPackages]);

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
      body: JSON.stringify({ packageId })
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

  async function handleAllocate(paymentId: string) {
    const subjectId = allocationSubject[paymentId];
    if (!subjectId) {
      setAllocationMessage("Selecione a disciplina antes de aplicar.");
      return;
    }

    setAllocationMessage(null);
    setAllocationId(paymentId);
    const response = await fetch("/api/credits/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, subjectId })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setAllocationMessage(data?.message ?? "Não foi possível aplicar o crédito.");
      setAllocationId(null);
      return;
    }

    setAllocationMessage("Crédito aplicado com sucesso.");
    setAllocationId(null);
    window.location.reload();
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

      {pendingCredits.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-900">Definir disciplina</h2>
          <p className="text-sm text-amber-700">
            Você tem pagamentos confirmados sem disciplina. Escolha para liberar os créditos.
          </p>
          <div className="mt-4 space-y-3">
            {pendingCredits.map((item) => (
              <div key={item.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.package.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.package.sessionCount} aula(s) • Pago em {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-amber-200 px-2 py-1 text-xs"
                      value={allocationSubject[item.id] ?? ""}
                      onChange={(event) =>
                        setAllocationSubject((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                    >
                      <option value="">Selecione a disciplina</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAllocate(item.id)}
                      disabled={allocationId === item.id}
                      className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-800 disabled:opacity-60"
                    >
                      {allocationId === item.id ? "Aplicando..." : "Aplicar créditos"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {allocationMessage && <p className="mt-3 text-sm text-amber-700">{allocationMessage}</p>}
        </div>
      )}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Planos e pacotes</h2>
          {!isChrome && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Pagamento via PIX
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
          >
            <option value="all">Todas as disciplinas</option>
            <option value="none">Sem disciplina</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Buscar por pacote ou disciplina"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="mt-4 space-y-4">
          {groupedPackages.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum pacote encontrado.</p>
          ) : (
            groupedPackages.map((group) => (
              <div key={group.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">{group.label}</h3>
                  <span className="text-xs text-slate-400">{group.items.length} item(s)</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {group.items.map((item) => {
                    const subscription = subscriptionMap.get(item.id);
                    return (
                      <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex flex-col gap-3">
                          <div>
                            <p className="text-xs text-slate-500">{item.subject?.name ?? "Sem disciplina"}</p>
                            <p className="text-base font-semibold text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">
                              {item.billingType === "SUBSCRIPTION" ? "Assinatura" : "Pacote"} • {item.sessionCount} aula(s)
                              {item.billingType === "SUBSCRIPTION" && item.billingCycle
                                ? ` / ${item.billingCycle === "MONTHLY" ? "mes" : "semana"}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-base font-semibold text-slate-700">{formatCurrency(item.priceCents)}</span>
                            {subscription && item.billingType === "SUBSCRIPTION" ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                                {subscription.status === "ACTIVE" ? "Assinatura ativa" : "Assinatura pendente"}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCheckout(item.id)}
                                disabled={loadingId === item.id || !hasDocument}
                                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                              >
                                {loadingId === item.id ? "Processando..." : "Contratar"}
                              </button>
                            )}
                          </div>
                          {subscription?.nextDueDate && (
                            <p className="text-xs text-slate-500">
                              Proxima cobranca: {new Date(subscription.nextDueDate).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
