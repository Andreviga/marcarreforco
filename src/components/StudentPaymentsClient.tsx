"use client";

import { useState } from "react";
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
  subject: SubjectOption | null;
}

interface BalanceItem {
  subject: SubjectOption;
  balance: number;
}

interface PendingCreditItem {
  id: string;
  createdAt: string;
  package: { name: string; sessionCount: number };
}

export default function StudentPaymentsClient({
  packages,
  balances,
  subjects,
  pendingCredits,
  document
}: {
  packages: PackageItem[];
  balances: BalanceItem[];
  subjects: SubjectOption[];
  pendingCredits: PendingCreditItem[];
  document: string | null;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [docValue, setDocValue] = useState(document ?? "");
  const [docError, setDocError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasDocument, setHasDocument] = useState(Boolean(document));
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [allocationId, setAllocationId] = useState<string | null>(null);
  const [allocationMessage, setAllocationMessage] = useState<string | null>(null);
  const [allocationSubject, setAllocationSubject] = useState<Record<string, string>>({});

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
    setPixCopyPaste(null);
    setPixQrCode(null);

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

    if (data?.pixCopyPaste) {
      setPixCopyPaste(data.pixCopyPaste);
      setPixQrCode(data.qrCodeImage ?? null);
      setMessage("PIX criado. Copie o codigo ou use o QR Code.");
      return;
    }

    setMessage("Pagamento criado. Aguarde a confirmacao.");
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
          <p className="text-sm text-amber-700">Precisamos do documento para criar a cobrança no Inter.</p>
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

      {pixCopyPaste && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">PIX para pagamento</h2>
              <p className="text-sm text-emerald-700">Use o QR Code ou copie o código abaixo.</p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white hover:bg-emerald-800"
              onClick={() => navigator.clipboard.writeText(pixCopyPaste)}
            >
              Copiar código
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr] md:items-center">
            {pixQrCode && (
              <img
                src={`data:image/png;base64,${pixQrCode}`}
                alt="QR Code PIX"
                className="h-36 w-36 rounded-lg border border-emerald-200 bg-white p-2"
              />
            )}
            <textarea
              readOnly
              className="min-h-[96px] w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs text-slate-700"
              value={pixCopyPaste}
            />
          </div>
        </div>
      )}

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
          <h2 className="text-lg font-semibold text-slate-900">Pacotes</h2>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Pagamento via PIX
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {packages.map((item) => {
            return (
              <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{item.subject?.name ?? "Disciplina"}</p>
                    <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      Pacote • {item.sessionCount} aula(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{formatCurrency(item.priceCents)}</span>
                    <button
                      type="button"
                      onClick={() => handleCheckout(item.id)}
                      disabled={loadingId === item.id || !hasDocument}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {loadingId === item.id ? "Processando..." : "Comprar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
