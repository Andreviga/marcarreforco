"use client";

import { useState } from "react";

const actions = [
  {
    key: "OLD_CANCELED_SESSIONS",
    title: "Excluir sessões canceladas antigas",
    description: "Remove sessões canceladas com mais de 2 meses (sem presenças e sem faturas), junto com inscrições vinculadas."
  },
  {
    key: "TEST_TEACHERS_UNUSED",
    title: "Excluir professores de teste sem vínculos",
    description: "Remove usuários professor com nome/e-mail contendo 'teste' e sem vínculos ativos."
  },
  {
    key: "TEST_SUBJECTS_UNUSED",
    title: "Excluir disciplinas de teste sem vínculos",
    description: "Remove disciplinas com nome contendo 'teste' que não possuem sessões, pacotes, professores ou créditos."
  }
] as const;

type CleanupAction = (typeof actions)[number]["key"];

export default function AdminCleanupClient() {
  const [loading, setLoading] = useState<CleanupAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runCleanup(action: CleanupAction) {
    setLoading(action);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data?.message ?? "Não foi possível executar a limpeza.");
        setLoading(null);
        return;
      }

      setMessage(`Limpeza executada: ${JSON.stringify(data.result)}`);
      setLoading(null);
    } catch {
      setMessage("Falha de conexão ao executar limpeza.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {actions.map((item) => (
        <div key={item.key} className="rounded-xl border border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{item.description}</p>
          <button
            type="button"
            onClick={() => runCleanup(item.key)}
            disabled={loading === item.key}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading === item.key ? "Executando..." : "Executar limpeza"}
          </button>
        </div>
      ))}

      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  );
}
