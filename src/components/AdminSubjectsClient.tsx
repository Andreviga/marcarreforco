"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

type EligibleSerie = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

interface Subject {
  id: string;
  name: string;
  defaultPriceCents?: number;
  eligibleSeries: string[];
}

const SERIE_OPTIONS: Array<{ value: EligibleSerie; label: string }> = [
  { value: "1", label: "1º ano" },
  { value: "2", label: "2º ano" },
  { value: "3", label: "3º ano" },
  { value: "4", label: "4º ano" },
  { value: "5", label: "5º ano" },
  { value: "6", label: "6º ano" },
  { value: "7", label: "7º ano" },
  { value: "8", label: "8º ano" },
  { value: "9", label: "9º ano" }
];

function isEligibleSerie(value: string): value is EligibleSerie {
  return ["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(value);
}

function formatEligibleSeries(value: string[]) {
  if (value.length === 0) return "Todas as séries";
  return value
    .filter(isEligibleSerie)
    .sort((a, b) => Number(a) - Number(b))
    .map((item) => `${item}º ano`)
    .join(", ");
}

function toggleSerie(current: EligibleSerie[], serie: EligibleSerie) {
  if (current.includes(serie)) {
    return current.filter((item) => item !== serie);
  }
  return [...current, serie];
}

export default function AdminSubjectsClient({ subjects }: { subjects: Subject[] }) {
  const [name, setName] = useState("");
  const [defaultPriceCents, setDefaultPriceCents] = useState(0);
  const [eligibleSeries, setEligibleSeries] = useState<EligibleSerie[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDefaultPriceCents, setEditDefaultPriceCents] = useState(0);
  const [editEligibleSeries, setEditEligibleSeries] = useState<EligibleSerie[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetch("/api/admin/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, defaultPriceCents, eligibleSeries })
    });
    window.location.reload();
  }

  function startEdit(subject: Subject) {
    setEditingId(subject.id);
    setEditName(subject.name);
    setEditDefaultPriceCents(subject.defaultPriceCents ?? 0);
    setEditEligibleSeries((subject.eligibleSeries ?? []).filter(isEligibleSerie));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDefaultPriceCents(0);
    setEditEligibleSeries([]);
  }

  async function handleUpdate() {
    if (!editingId) return;
    await fetch("/api/admin/subjects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name: editName,
        defaultPriceCents: editDefaultPriceCents,
        eligibleSeries: editEligibleSeries
      })
    });
    window.location.reload();
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Excluir esta disciplina? Essa ação não pode ser desfeita.");
    if (!confirmed) return;
    setDeleteError(null);
    const response = await fetch(`/api/admin/subjects?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setDeleteError(data?.message ?? "Não foi possível excluir a disciplina.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Nova disciplina</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Matemática"
          />
          <input
            className="w-32 rounded-lg border border-slate-200 px-3 py-2"
            type="number"
            value={defaultPriceCents}
            onChange={(event) => setDefaultPriceCents(Number(event.target.value))}
            placeholder="Ex.: 5000"
          />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">Criar</button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {SERIE_OPTIONS.map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={eligibleSeries.includes(option.value)}
                onChange={() => setEligibleSeries((current) => toggleSerie(current, option.value))}
              />
              {option.label}
            </label>
          ))}
        </div>
        <span className="mt-2 block text-xs text-slate-500">Sem seleção = todas as séries (1º ao 9º ano)</span>
        <p className="mt-2 text-xs text-slate-500">Valor em centavos (R$ 50,00 = 5000). Deixe 0 para usar preço manual.</p>
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Disciplinas cadastradas</h2>
        {deleteError && <p className="mt-2 text-sm text-rose-600">{deleteError}</p>}
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {subjects.map((subject) => (
            <li key={subject.id} className="rounded-lg border border-slate-100 p-2">
              {editingId === subject.id ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                    <input
                      className="w-32 rounded-lg border border-slate-200 px-3 py-2"
                      type="number"
                      value={editDefaultPriceCents}
                      onChange={(event) => setEditDefaultPriceCents(Number(event.target.value))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
                    {SERIE_OPTIONS.map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={editEligibleSeries.includes(option.value)}
                          onChange={() => setEditEligibleSeries((current) => toggleSerie(current, option.value))}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">Sem seleção = todas as séries (1º ao 9º ano)</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUpdate}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-900">{subject.name}</span>
                    {typeof subject.defaultPriceCents === "number" && subject.defaultPriceCents > 0
                      ? ` • Valor: ${formatCurrency(subject.defaultPriceCents)}`
                      : ""}
                    {` • Séries: ${formatEligibleSeries(subject.eligibleSeries ?? [])}`}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(subject)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(subject.id)}
                      className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-600"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
