"use client";

import { useState } from "react";

interface Subject {
  id: string;
  name: string;
}

interface OnboardingClientProps {
  role: "ALUNO" | "PROFESSOR";
  subjects: Subject[];
  initialSerie?: string;
  initialTurma?: string;
  initialUnidade?: string;
  initialSubjectIds?: string[];
}

export default function OnboardingClient({
  role,
  subjects,
  initialSerie = "",
  initialTurma = "",
  initialUnidade = "Colégio Raízes",
  initialSubjectIds = []
}: OnboardingClientProps) {
  const [serie, setSerie] = useState(initialSerie);
  const [turma, setTurma] = useState(initialTurma);
  const [unidade, setUnidade] = useState(initialUnidade);
  const [subjectIds, setSubjectIds] = useState<string[]>(initialSubjectIds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleSubject(id: string) {
    setSubjectIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload =
      role === "ALUNO"
        ? { serie, turma, unidade }
        : { subjectIds };

    const response = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.message ?? "Não foi possível salvar.");
      setSaving(false);
      return;
    }

    window.location.href = role === "ALUNO" ? "/aluno/agenda" : "/professor/sessoes";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Complete seus dados</h1>
        <p className="text-sm text-slate-500">Precisamos de algumas informacoes antes de continuar.</p>
      </div>

      {role === "ALUNO" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Serie
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={serie}
              onChange={(event) => setSerie(event.target.value)}
              required
            />
          </label>
          <label className="text-sm text-slate-600">
            Turma
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={turma}
              onChange={(event) => setTurma(event.target.value)}
              required
            />
          </label>
          <label className="text-sm text-slate-600 md:col-span-2">
            Unidade
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={unidade}
              onChange={(event) => setUnidade(event.target.value)}
              required
            />
          </label>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-slate-700">Selecione suas disciplinas</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {subjects.map((subject) => (
              <label key={subject.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={subjectIds.includes(subject.id)}
                  onChange={() => toggleSubject(subject.id)}
                />
                {subject.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
        disabled={saving}
      >
        Salvar e continuar
      </button>
    </form>
  );
}
