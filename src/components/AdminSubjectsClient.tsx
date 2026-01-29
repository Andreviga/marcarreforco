"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

interface Subject {
  id: string;
  name: string;
  defaultPriceCents?: number;
}

export default function AdminSubjectsClient({ subjects }: { subjects: Subject[] }) {
  const [name, setName] = useState("");
  const [defaultPriceCents, setDefaultPriceCents] = useState(0);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetch("/api/admin/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, defaultPriceCents })
    });
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
            placeholder="Nome da disciplina"
          />
          <input
            className="w-32 rounded-lg border border-slate-200 px-3 py-2"
            type="number"
            value={defaultPriceCents}
            onChange={(event) => setDefaultPriceCents(Number(event.target.value))}
            placeholder="Preço"
          />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
            Criar
          </button>
        </div>
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Disciplinas cadastradas</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {subjects.map((subject) => (
            <li key={subject.id} className="rounded-lg border border-slate-100 p-2">
              {subject.name}
              {typeof subject.defaultPriceCents === "number" && subject.defaultPriceCents > 0
                ? ` - ${formatCurrency(subject.defaultPriceCents)}`
                : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
