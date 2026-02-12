"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

interface SessionPackage {
  id: string;
  name: string;
  sessionCount: number;
  priceCents: number;
  active: boolean;
  billingType: "PACKAGE" | "SUBSCRIPTION";
  billingCycle: "MONTHLY" | "WEEKLY" | null;
  subjectId: string | null;
}

interface SubjectOption {
  id: string;
  name: string;
}

export default function AdminPackagesClient({
  packages,
  subjects
}: {
  packages: SessionPackage[];
  subjects: SubjectOption[];
}) {
  const [name, setName] = useState("");
  const [sessionCount, setSessionCount] = useState(1);
  const [priceCents, setPriceCents] = useState(0);
  const [active, setActive] = useState(true);
  const [billingType, setBillingType] = useState<"PACKAGE" | "SUBSCRIPTION">("PACKAGE");
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "WEEKLY">("MONTHLY");
  const [subjectId, setSubjectId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const response = await fetch("/api/admin/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sessionCount,
        priceCents,
        active,
        billingType,
        billingCycle: billingType === "SUBSCRIPTION" ? billingCycle : null,
        subjectId: subjectId || null
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setFormError(data?.message ?? "Não foi possível criar o pacote.");
      return;
    }
    setFormSuccess("Pacote criado com sucesso.");
    window.location.reload();
  }

  async function handleUpdate(item: SessionPackage) {
    await fetch("/api/admin/packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
    window.location.reload();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/packages?id=${id}`, { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Novo pacote</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do pacote"
            required
          />
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value="">Sem disciplina (escolha do aluno)</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            type="number"
            min={1}
            value={sessionCount}
            onChange={(event) => setSessionCount(Number(event.target.value))}
            placeholder="Aulas"
            required
          />
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            type="number"
            min={0}
            value={priceCents}
            onChange={(event) => setPriceCents(Number(event.target.value))}
            placeholder="Valor"
            required
          />
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={billingType}
            onChange={(event) => setBillingType(event.target.value as "PACKAGE" | "SUBSCRIPTION")}
          >
            <option value="PACKAGE">Pacote avulso</option>
            <option value="SUBSCRIPTION">Assinatura</option>
          </select>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={billingCycle}
            onChange={(event) => setBillingCycle(event.target.value as "MONTHLY" | "WEEKLY")}
            disabled={billingType !== "SUBSCRIPTION"}
          >
            <option value="MONTHLY">Mensal</option>
            <option value="WEEKLY">Semanal</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Ativo
          </label>
        </div>
        <button className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
          Criar
        </button>
        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
        {formSuccess && <p className="mt-3 text-sm text-emerald-600">{formSuccess}</p>}
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Pacotes cadastrados</h2>
        <div className="mt-3 space-y-3">
          {packages.map((item) => (
            <PackageRow
              key={item.id}
              item={item}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              subjects={subjects}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PackageRow({
  item,
  onUpdate,
  onDelete,
  subjects
}: {
  item: SessionPackage;
  onUpdate: (item: SessionPackage) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  subjects: SubjectOption[];
}) {
  const [name, setName] = useState(item.name);
  const [sessionCount, setSessionCount] = useState(item.sessionCount);
  const [priceCents, setPriceCents] = useState(item.priceCents);
  const [active, setActive] = useState(item.active);
  const [billingType, setBillingType] = useState<"PACKAGE" | "SUBSCRIPTION">(item.billingType);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "WEEKLY">(item.billingCycle ?? "MONTHLY");
  const [subjectId, setSubjectId] = useState(item.subjectId ?? "");

  return (
    <div className="grid gap-2 rounded-lg border border-slate-100 p-3 text-sm md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto_auto] md:items-center">
      <input
        className="rounded-lg border border-slate-200 px-3 py-2"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <select
        className="rounded-lg border border-slate-200 px-3 py-2"
        value={subjectId}
        onChange={(event) => setSubjectId(event.target.value)}
      >
        <option value="">Sem disciplina</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </select>
      <input
        className="rounded-lg border border-slate-200 px-3 py-2"
        type="number"
        min={1}
        value={sessionCount}
        onChange={(event) => setSessionCount(Number(event.target.value))}
      />
      <input
        className="rounded-lg border border-slate-200 px-3 py-2"
        type="number"
        min={0}
        value={priceCents}
        onChange={(event) => setPriceCents(Number(event.target.value))}
      />
      <select
        className="rounded-lg border border-slate-200 px-3 py-2"
        value={billingType}
        onChange={(event) => setBillingType(event.target.value as "PACKAGE" | "SUBSCRIPTION")}
      >
        <option value="PACKAGE">Pacote avulso</option>
        <option value="SUBSCRIPTION">Assinatura</option>
      </select>
      <select
        className="rounded-lg border border-slate-200 px-3 py-2"
        value={billingCycle}
        onChange={(event) => setBillingCycle(event.target.value as "MONTHLY" | "WEEKLY")}
        disabled={billingType !== "SUBSCRIPTION"}
      >
        <option value="MONTHLY">Mensal</option>
        <option value="WEEKLY">Semanal</option>
      </select>
      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        Ativo
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            onUpdate({
              id: item.id,
              name,
              sessionCount,
              priceCents,
              active,
              billingType,
              billingCycle: billingType === "SUBSCRIPTION" ? billingCycle : null,
              subjectId: subjectId || null
            })
          }
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-slate-300"
        >
          Excluir
        </button>
      </div>
      <p className="md:col-span-7 text-xs text-slate-500">
        {sessionCount} aulas • Valor: {formatCurrency(priceCents)} • {billingType === "SUBSCRIPTION" ? "Assinatura" : "Pacote"}
      </p>
    </div>
  );
}
