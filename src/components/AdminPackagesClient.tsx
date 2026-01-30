"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

interface SessionPackage {
  id: string;
  name: string;
  sessionCount: number;
  priceCents: number;
  active: boolean;
}

export default function AdminPackagesClient({ packages }: { packages: SessionPackage[] }) {
  const [name, setName] = useState("");
  const [sessionCount, setSessionCount] = useState(1);
  const [priceCents, setPriceCents] = useState(0);
  const [active, setActive] = useState(true);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetch("/api/admin/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sessionCount, priceCents, active })
    });
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
        <div className="mt-3 grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do pacote"
            required
          />
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
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Pacotes cadastrados</h2>
        <div className="mt-3 space-y-3">
          {packages.map((item) => (
            <PackageRow key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PackageRow({
  item,
  onUpdate,
  onDelete
}: {
  item: SessionPackage;
  onUpdate: (item: SessionPackage) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [sessionCount, setSessionCount] = useState(item.sessionCount);
  const [priceCents, setPriceCents] = useState(item.priceCents);
  const [active, setActive] = useState(item.active);

  return (
    <div className="grid gap-2 rounded-lg border border-slate-100 p-3 text-sm md:grid-cols-[2fr_1fr_1fr_auto_auto] md:items-center">
      <input
        className="rounded-lg border border-slate-200 px-3 py-2"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
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
      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        Ativo
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onUpdate({ id: item.id, name, sessionCount, priceCents, active })}
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
      <p className="md:col-span-5 text-xs text-slate-500">
        {sessionCount} aulas • Valor: {formatCurrency(priceCents)}
      </p>
    </div>
  );
}
