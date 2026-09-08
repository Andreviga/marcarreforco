"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [name, setName] = useState("");
  const [sessionCount, setSessionCount] = useState(1);
  const [priceCents, setPriceCents] = useState(0);
  const [active, setActive] = useState(true);
  const [billingType, setBillingType] = useState<"PACKAGE" | "SUBSCRIPTION">("PACKAGE");
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "WEEKLY">("MONTHLY");
  const [subjectId, setSubjectId] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listSuccess, setListSuccess] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [listStatus, setListStatus] = useState<"all" | "active" | "inactive">("active");
  const [bulkRunning, setBulkRunning] = useState(false);
  const requiresGeneralSubject =
    billingType === "SUBSCRIPTION" &&
    ((billingCycle === "WEEKLY" && sessionCount > 1) || (billingCycle === "MONTHLY" && sessionCount > 4));

  useEffect(() => {
    if (requiresGeneralSubject && subjectId) {
      setSubjectId("");
    }
  }, [requiresGeneralSubject, subjectId]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setFormError(null);
    setFormSuccess(null);
    try {
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
      setName("");
      setSessionCount(1);
      setPriceCents(0);
      setActive(true);
      setBillingType("PACKAGE");
      setBillingCycle("MONTHLY");
      setSubjectId("");
      router.refresh();
    } catch {
      setFormError("Falha de conexão. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(item: SessionPackage) {
    if (busyId) return;
    setBusyId(item.id);
    setListError(null);
    setListSuccess(null);
    try {
      const response = await fetch("/api/admin/packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setListError(data?.message ?? "Não foi possível atualizar o pacote.");
        return;
      }
      setListSuccess(`Pacote "${item.name}" atualizado com sucesso.`);
      router.refresh();
    } catch {
      setListError("Falha de conexão. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  // Desativa em massa os pacotes atrelados a uma disciplina, mantendo os
  // genéricos ("sem disciplina") — reversível pacote a pacote pelo "Ativo".
  async function handleBulkDeactivateSubjectPackages() {
    const targets = packages.filter((item) => item.subjectId && item.active);
    if (!targets.length) {
      setListError("Nenhum pacote ativo com disciplina para desativar.");
      return;
    }
    const confirmed = window.confirm(
      `Desativar ${targets.length} pacote(s) com disciplina? Eles somem da loja do aluno, mas podem ser reativados um a um.`
    );
    if (!confirmed || bulkRunning) return;
    setBulkRunning(true);
    setListError(null);
    setListSuccess(null);
    let ok = 0;
    let failed = 0;
    try {
      for (const item of targets) {
        try {
          const response = await fetch("/api/admin/packages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...item, active: false })
          });
          if (response.ok) ok += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      if (failed) {
        setListError(`${ok} desativado(s), ${failed} com erro. Tente novamente para os restantes.`);
      } else {
        setListSuccess(`${ok} pacote(s) com disciplina desativado(s).`);
      }
      router.refresh();
    } finally {
      setBulkRunning(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Excluir este pacote? Essa ação não pode ser desfeita.");
    if (!confirmed) return;
    if (busyId) return;
    setBusyId(id);
    setListError(null);
    setListSuccess(null);
    try {
      const response = await fetch(`/api/admin/packages?id=${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setListError(data?.message ?? "Não foi possível excluir o pacote.");
        return;
      }
      setListSuccess("Pacote excluído com sucesso.");
      router.refresh();
    } catch {
      setListError("Falha de conexão. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Novo pacote</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <label className="text-sm text-slate-600">
            Nome do pacote
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: 2 dias/semana - 4o ao 9o"
              required
            />
          </label>
          <label className="text-sm text-slate-600">
            Disciplina
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              disabled={requiresGeneralSubject}
            >
              <option value="">Sem disciplina (escolha do aluno)</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-400">Vazio permite escolher na hora do pagamento.</span>
          </label>
          <label className="text-sm text-slate-600">
            Quantidade de aulas
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              type="number"
              min={1}
              value={sessionCount}
              onChange={(event) => setSessionCount(Number(event.target.value))}
              placeholder="Ex.: 4"
              required
            />
            <span className="mt-1 block text-xs text-slate-400">Total de aulas no pacote.</span>
          </label>
          <label className="text-sm text-slate-600">
            Valor (centavos)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              type="number"
              min={0}
              value={priceCents}
              onChange={(event) => setPriceCents(Number(event.target.value))}
              placeholder="Ex.: 900"
              required
            />
            <span className="mt-1 block text-xs text-slate-400">R$ 9,00 = 900.</span>
          </label>
          <label className="text-sm text-slate-600">
            Tipo de cobrança
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={billingType}
              onChange={(event) => setBillingType(event.target.value as "PACKAGE" | "SUBSCRIPTION")}
            >
              <option value="PACKAGE">Pacote avulso</option>
              <option value="SUBSCRIPTION">Assinatura</option>
            </select>
            <span className="mt-1 block text-xs text-slate-400">Assinaturas renovam automaticamente.</span>
          </label>
          <label className="text-sm text-slate-600">
            Ciclo
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={billingCycle}
              onChange={(event) => setBillingCycle(event.target.value as "MONTHLY" | "WEEKLY")}
              disabled={billingType !== "SUBSCRIPTION"}
            >
              <option value="MONTHLY">Mensal</option>
              <option value="WEEKLY">Semanal</option>
            </select>
            <span className="mt-1 block text-xs text-slate-400">Obrigatório para assinatura.</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Ativo
          </label>
        </div>
        <button
          disabled={creating}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? "Criando..." : "Criar"}
        </button>
        {requiresGeneralSubject && (
          <p className="mt-2 text-xs text-slate-500">
            Para mais de 1 aula por semana, a disciplina fica livre para o aluno escolher.
          </p>
        )}
        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
        {formSuccess && <p className="mt-3 text-sm text-emerald-600">{formSuccess}</p>}
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Pacotes cadastrados</h2>
          <button
            type="button"
            onClick={handleBulkDeactivateSubjectPackages}
            disabled={bulkRunning}
            className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bulkRunning ? "Desativando..." : "Desativar pacotes por disciplina"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm md:max-w-xs"
            placeholder="Buscar por nome"
            value={listSearch}
            onChange={(event) => setListSearch(event.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={listStatus}
            onChange={(event) => setListStatus(event.target.value as "all" | "active" | "inactive")}
          >
            <option value="active">Somente ativos</option>
            <option value="inactive">Somente inativos</option>
            <option value="all">Todos</option>
          </select>
        </div>
        {listError && <p className="mt-2 text-sm text-red-600">{listError}</p>}
        {listSuccess && <p className="mt-2 text-sm text-emerald-600">{listSuccess}</p>}
        {(() => {
          const visible = packages.filter((item) => {
            const matchesSearch = item.name.toLowerCase().includes(listSearch.toLowerCase());
            const matchesStatus =
              listStatus === "all" || (listStatus === "active" ? item.active : !item.active);
            return matchesSearch && matchesStatus;
          });
          return (
            <>
              <p className="mt-2 text-xs text-slate-400">
                Mostrando {visible.length} de {packages.length} pacote(s).
              </p>
              {visible.length === 0 && (
                <p className="mt-3 text-sm text-slate-500">Nenhum pacote com esses filtros.</p>
              )}
              <div className="mt-3 space-y-3">
                {visible.map((item) => (
            <PackageRow
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              subjects={subjects}
            />
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function PackageRow({
  item,
  busy,
  onUpdate,
  onDelete,
  subjects
}: {
  item: SessionPackage;
  busy: boolean;
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
  const requiresGeneralSubject =
    billingType === "SUBSCRIPTION" &&
    ((billingCycle === "WEEKLY" && sessionCount > 1) || (billingCycle === "MONTHLY" && sessionCount > 4));

  // Re-sincroniza o estado local quando os dados do servidor mudarem (router.refresh)
  useEffect(() => {
    setName(item.name);
    setSessionCount(item.sessionCount);
    setPriceCents(item.priceCents);
    setActive(item.active);
    setBillingType(item.billingType);
    setBillingCycle(item.billingCycle ?? "MONTHLY");
    setSubjectId(item.subjectId ?? "");
  }, [item]);

  useEffect(() => {
    if (requiresGeneralSubject && subjectId) {
      setSubjectId("");
    }
  }, [requiresGeneralSubject, subjectId]);

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
        disabled={requiresGeneralSubject}
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
          disabled={busy}
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
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDelete(item.id)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-slate-300 disabled:opacity-60"
        >
          Excluir
        </button>
      </div>
      <p className="md:col-span-7 text-xs text-slate-500">
        {sessionCount} aulas • Valor: {formatCurrency(priceCents)} • {billingType === "SUBSCRIPTION" ? "Assinatura" : "Pacote"}
        {requiresGeneralSubject ? " • Disciplina livre" : ""}
      </p>
    </div>
  );
}
