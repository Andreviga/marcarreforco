"use client";

import { useState } from "react";
import Link from "next/link";

interface TicketRow {
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
  _count?: { messages: number };
}

interface BasicUser {
  id: string;
  name: string;
}

interface TicketsClientProps {
  role: "ALUNO" | "PROFESSOR" | "ADMIN";
  tickets: TicketRow[];
  teachers?: BasicUser[];
  students?: BasicUser[];
  basePath: string;
}

const statusLabels: Record<TicketRow["status"], string> = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDO: "Resolvido",
  FECHADO: "Fechado"
};

const categoryLabels: Record<TicketRow["category"], string> = {
  DUVIDA: "Dúvida",
  MELHORIA: "Melhoria"
};

export default function TicketsClient({ role, tickets, teachers = [], students = [], basePath }: TicketsClientProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [category, setCategory] = useState<TicketRow["category"]>(
    role === "PROFESSOR" ? "MELHORIA" : "DUVIDA"
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const payload = {
      title,
      description,
      category,
      teacherId: role === "ALUNO" || role === "ADMIN" ? teacherId : "",
      studentId: role === "PROFESSOR" || role === "ADMIN" ? studentId : ""
    };

    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setFormError(data?.message ?? "Não foi possível enviar a dúvida.");
      setSubmitting(false);
      return;
    }

    window.location.reload();
  }

  function formatDate(value: string | Date) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Nova dúvida</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Título
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Dúvida sobre frações"
              required
            />
          </label>
          {role === "ADMIN" && (
            <label className="text-sm text-slate-600">
              Categoria
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={category}
                onChange={(event) => setCategory(event.target.value as TicketRow["category"])}
              >
                <option value="DUVIDA">Dúvida</option>
                <option value="MELHORIA">Melhoria</option>
              </select>
            </label>
          )}
          {(role === "ALUNO" || role === "ADMIN") && (
            <label className="text-sm text-slate-600">
              Professor
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={teacherId}
                onChange={(event) => setTeacherId(event.target.value)}
                required
              >
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(role === "PROFESSOR" || role === "ADMIN") && (
            <label className="text-sm text-slate-600">
              Aluno
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                required
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm text-slate-600 md:col-span-2">
            Descrição
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={role === "PROFESSOR" ? "Descreva o que o aluno precisa melhorar" : "Descreva sua dúvida"}
              required
            />
          </label>
        </div>
        {formError && <p className="mt-2 text-sm text-rose-600">{formError}</p>}
        <button
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={submitting}
        >
          Enviar dúvida
        </button>
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Dúvidas</h2>
        <div className="mt-3 space-y-3">
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma dúvida encontrada.</p>
          ) : (
            tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`${basePath}/${ticket.id}`}
                className="block rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ticket.title}</p>
                    <p className="text-xs text-slate-500">
                      {categoryLabels[ticket.category]} • {statusLabels[ticket.status]}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {ticket._count?.messages ?? 0} mensagens • Atualizado em {formatDate(ticket.updatedAt)}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Aluno: {ticket.student.name} • Professor: {ticket.teacher.name}
                </p>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
