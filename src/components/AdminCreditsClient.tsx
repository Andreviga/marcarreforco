"use client";

import { useState } from "react";

interface SubjectEntry {
  subjectId: string;
  subjectName: string;
  balance: number;
  expiresAt: string;
  received: number;
  enrolled: number;
}

interface LedgerEntry {
  id: string;
  subjectName: string;
  delta: number;
  reason: string;
  reasonLabel: string;
  sessionDate: string | null;
  createdAt: string;
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
  balances: SubjectEntry[];
  total: number;
}

interface SubjectOption {
  id: string;
  name: string;
}

export default function AdminCreditsClient({
  students,
  subjects
}: {
  students: StudentRow[];
  subjects: SubjectOption[];
}) {
  const [search, setSearch] = useState("");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustSubjectId, setAdjustSubjectId] = useState(subjects[0]?.id ?? "");
  const [adjustDelta, setAdjustDelta] = useState(1);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<LedgerEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdjust(studentId: string) {
    if (!adjustSubjectId || adjustDelta === 0) return;
    setAdjusting(true);
    setAdjustError(null);
    setAdjustSuccess(null);
    try {
      const res = await fetch("/api/admin/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: studentId, subjectId: adjustSubjectId, delta: adjustDelta })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAdjustError(data?.message ?? "Erro ao ajustar créditos.");
      } else {
        setAdjustSuccess(
          `Créditos ${adjustDelta > 0 ? "adicionados" : "removidos"} com sucesso.`
        );
        setTimeout(() => {
          setAdjustingId(null);
          setAdjustSuccess(null);
          window.location.reload();
        }, 1200);
      }
    } catch {
      setAdjustError("Falha de conexão.");
    } finally {
      setAdjusting(false);
    }
  }

  async function toggleHistory(studentId: string) {
    if (historyId === studentId) {
      setHistoryId(null);
      return;
    }
    setHistoryId(studentId);
    setHistoryEntries([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/credits/${studentId}/history`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHistoryError(data?.message ?? "Erro ao carregar histórico.");
      } else {
        setHistoryEntries(data);
      }
    } catch {
      setHistoryError("Falha de conexão.");
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              {students.length} aluno{students.length !== 1 ? "s" : ""} cadastrado
              {students.length !== 1 ? "s" : ""}
            </p>
          </div>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:w-64"
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
          Nenhum aluno encontrado.
        </div>
      )}

      <div className="grid gap-4">
        {filtered.map((student) => (
          <div key={student.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{student.name}</p>
                <p className="text-xs text-slate-500">{student.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    student.total > 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {student.total} crédito{student.total !== 1 ? "s" : ""} no total
                </span>
                <button
                  onClick={() => toggleHistory(student.id)}
                  className={`rounded-md border px-2 py-1 text-xs hover:bg-slate-50 ${
                    historyId === student.id
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {historyId === student.id ? "Fechar histórico" : "Ver histórico"}
                </button>
                <button
                  onClick={() => {
                    setAdjustingId(adjustingId === student.id ? null : student.id);
                    setAdjustSubjectId(subjects[0]?.id ?? "");
                    setAdjustDelta(1);
                    setAdjustError(null);
                    setAdjustSuccess(null);
                  }}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Ajustar créditos
                </button>
              </div>
            </div>

            {student.balances.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-slate-400">
                      <th className="pb-1 text-left font-medium">Disciplina</th>
                      <th className="pb-1 text-right font-medium">Recebidos</th>
                      <th className="pb-1 text-right font-medium">Inscritos</th>
                      <th className="pb-1 text-right font-medium">Saldo atual</th>
                      <th className="pb-1 text-right font-medium">Expira em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.balances.map((b) => (
                      <tr key={b.subjectId} className="border-b border-slate-50">
                        <td className="py-1.5 text-slate-700">{b.subjectName}</td>
                        <td className="py-1.5 text-right text-slate-600">{b.received}</td>
                        <td className="py-1.5 text-right text-slate-600">{b.enrolled}</td>
                        <td className="py-1.5 text-right font-semibold text-slate-900">
                          {b.balance}
                        </td>
                        <td className="py-1.5 text-right text-xs text-slate-400">
                          {b.balance > 0
                            ? new Date(b.expiresAt).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric"
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Sem créditos ativos.</p>
            )}

            {historyId === student.id && (
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-600">
                  Histórico de uso de créditos
                </p>
                {historyLoading && (
                  <p className="text-xs text-slate-400">Carregando...</p>
                )}
                {historyError && (
                  <p className="text-xs text-rose-600">{historyError}</p>
                )}
                {!historyLoading && !historyError && historyEntries.length === 0 && (
                  <p className="text-xs text-slate-400">Sem movimentações.</p>
                )}
                {!historyLoading && historyEntries.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-slate-400">
                          <th className="pb-1 text-left font-medium">Data</th>
                          <th className="pb-1 text-left font-medium">Disciplina</th>
                          <th className="pb-1 text-left font-medium">Motivo</th>
                          <th className="pb-1 text-left font-medium">Sessão</th>
                          <th className="pb-1 text-right font-medium">Créditos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyEntries.map((e) => (
                          <tr key={e.id} className="border-b border-slate-100">
                            <td className="py-1 text-slate-500">
                              {new Date(e.createdAt).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric"
                              })}
                            </td>
                            <td className="py-1 text-slate-700">{e.subjectName}</td>
                            <td className="py-1 text-slate-600">{e.reasonLabel}</td>
                            <td className="py-1 text-slate-500">
                              {e.sessionDate
                                ? new Date(e.sessionDate).toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric"
                                  })
                                : "—"}
                            </td>
                            <td
                              className={`py-1 text-right font-semibold ${
                                e.delta > 0 ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {e.delta > 0 ? `+${e.delta}` : e.delta}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {adjustingId === student.id && (
              <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                <p className="mb-2 text-xs font-semibold text-indigo-700">Ajuste manual de créditos</p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex-1 text-xs text-slate-600">
                    Disciplina
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={adjustSubjectId}
                      onChange={(e) => setAdjustSubjectId(e.target.value)}
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-28 text-xs text-slate-600">
                    Quantidade
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={adjustDelta}
                      onChange={(e) => setAdjustDelta(Number(e.target.value))}
                      placeholder="Ex: 2 ou -1"
                    />
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      Positivo = adicionar; negativo = remover
                    </span>
                  </label>
                  <button
                    disabled={adjusting || adjustDelta === 0}
                    onClick={() => handleAdjust(student.id)}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {adjusting ? "Salvando..." : "Confirmar"}
                  </button>
                  <button
                    onClick={() => {
                      setAdjustingId(null);
                      setAdjustError(null);
                      setAdjustSuccess(null);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
                {adjustError && (
                  <p className="mt-2 text-xs text-rose-600">{adjustError}</p>
                )}
                {adjustSuccess && (
                  <p className="mt-2 text-xs text-emerald-600">{adjustSuccess}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
