"use client";

import { useState } from "react";

interface TicketMessageRow {
  id: string;
  message: string;
  createdAt: string | Date;
  author: { id: string; name: string; role: string };
}

interface TicketDetail {
  id: string;
  title: string;
  description: string;
  category: "MELHORIA" | "DUVIDA";
  status: "ABERTO" | "EM_ANDAMENTO" | "RESOLVIDO" | "FECHADO";
  createdAt: string | Date;
  updatedAt: string | Date;
  student: { id: string; name: string };
  teacher: { id: string; name: string };
  createdBy: { id: string; name: string; role: string };
  messages: TicketMessageRow[];
}

const statusLabels: Record<TicketDetail["status"], string> = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDO: "Resolvido",
  FECHADO: "Fechado"
};

const categoryLabels: Record<TicketDetail["category"], string> = {
  DUVIDA: "Dúvida",
  MELHORIA: "Melhoria"
};

export default function TicketDetailClient({ ticket, role }: { ticket: TicketDetail; role: "ALUNO" | "PROFESSOR" | "ADMIN" }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(ticket.status);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function formatDate(value: string | Date) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  async function handleMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;

    setFormError(null);
    setSubmitting(true);

    const response = await fetch(`/api/tickets/${ticket.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setFormError(data?.message ?? "Não foi possível enviar a mensagem.");
      setSubmitting(false);
      return;
    }

    window.location.reload();
  }

  async function handleStatusUpdate(nextStatus: TicketDetail["status"]) {
    setFormError(null);
    setSubmitting(true);

    const response = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setFormError(data?.message ?? "Não foi possível atualizar o status.");
      setSubmitting(false);
      return;
    }

    setStatus(nextStatus);
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{ticket.title}</h2>
            <p className="text-xs text-slate-500">
              {categoryLabels[ticket.category]} • {statusLabels[status]} • Atualizado em {formatDate(ticket.updatedAt)}
            </p>
            <p className="mt-2 text-sm text-slate-600">{ticket.description}</p>
          </div>
          {role === "ADMIN" && (
            <div className="text-sm text-slate-600">
              <label>
                Status
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={status}
                  onChange={(event) => handleStatusUpdate(event.target.value as TicketDetail["status"])}
                  disabled={submitting}
                >
                  <option value="ABERTO">Aberto</option>
                  <option value="EM_ANDAMENTO">Em andamento</option>
                  <option value="RESOLVIDO">Resolvido</option>
                  <option value="FECHADO">Fechado</option>
                </select>
              </label>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Aluno: {ticket.student.name} • Professor: {ticket.teacher.name} • Criado por: {ticket.createdBy.name}
        </p>
        {formError && <p className="mt-2 text-sm text-rose-600">{formError}</p>}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Mensagens</h3>
        <div className="mt-3 space-y-3">
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda não há mensagens.</p>
          ) : (
            ticket.messages.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">{item.author.name}</p>
                  <p className="text-xs text-slate-400">{formatDate(item.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.message}</p>
              </div>
            ))
          )}
        </div>
        <form onSubmit={handleMessage} className="mt-4 space-y-2">
          <label className="text-sm text-slate-600">
            Nova mensagem
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-slate-200 px-3 py-2"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escreva sua mensagem"
              required
            />
          </label>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={submitting}
          >
            Enviar mensagem
          </button>
        </form>
      </div>
    </div>
  );
}
