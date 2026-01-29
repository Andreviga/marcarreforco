"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";

interface Subject {
  id: string;
  name: string;
  defaultPriceCents?: number;
}

interface Teacher {
  id: string;
  name: string;
}

interface SessionItem {
  id: string;
  startsAt: string | Date;
  endsAt: string | Date;
  location: string;
  modality: string;
  priceCents: number;
  status: string;
  subject: Subject;
  teacher: Teacher;
}

export default function AdminSessionsClient({
  sessions,
  subjects,
  teachers
}: {
  sessions: SessionItem[];
  subjects: Subject[];
  teachers: Teacher[];
}) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:30");
  const [location, setLocation] = useState("Sala 1");
  const [modality, setModality] = useState("PRESENCIAL");
  const [price, setPrice] = useState(subjects[0]?.defaultPriceCents ?? 5000);
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  async function createSessions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) return;

    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = new Date(`${date}T${endTime}:00`);

    const payloadBase = {
      subjectId,
      teacherId,
      location,
      modality,
      priceCents: Number(price)
    };

    const requests = Array.from({ length: repeatWeeks }).map((_, index) => {
      const startsAt = new Date(startDate);
      startsAt.setDate(startsAt.getDate() + index * 7);
      const endsAt = new Date(endDate);
      endsAt.setDate(endsAt.getDate() + index * 7);

      return fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payloadBase,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString()
        })
      });
    });

    await Promise.all(requests);
    window.location.reload();
  }

  async function cancelSession(id: string) {
    await fetch("/api/admin/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "CANCELADA" })
    });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createSessions} className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Nova sessão</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Disciplina
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={subjectId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSubjectId(nextId);
                const subject = subjects.find((item) => item.id === nextId);
                if (subject?.defaultPriceCents) {
                  setPrice(subject.defaultPriceCents);
                }
              }}
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Professor
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Data
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label className="text-sm text-slate-600">
            Início
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-600">
            Fim
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-600">
            Local
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-600">
            Modalidade
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={modality}
              onChange={(event) => setModality(event.target.value)}
            >
              <option value="PRESENCIAL">Presencial</option>
              <option value="ONLINE">Online</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Preço (centavos)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={price}
              onChange={(event) => setPrice(Number(event.target.value))}
            />
          </label>
          <label className="text-sm text-slate-600">
            Repetir por (semanas)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              min={1}
              value={repeatWeeks}
              onChange={(event) => setRepeatWeeks(Number(event.target.value))}
            />
          </label>
        </div>
        <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
          Criar sessões
        </button>
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Agenda</h2>
        <div className="mt-3 grid gap-3">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-slate-900">{session.subject.name}</p>
                <p className="text-xs text-slate-500">
                  {format(new Date(session.startsAt), "dd/MM HH:mm")} - {format(new Date(session.endsAt), "HH:mm")}
                </p>
                <p className="text-xs text-slate-500">{session.teacher.name}</p>
                <p className="text-xs text-slate-500">{formatCurrency(session.priceCents)}</p>
                <p className="text-xs text-slate-400">Status: {session.status}</p>
              </div>
              {session.status === "ATIVA" && (
                <button
                  onClick={() => cancelSession(session.id)}
                  className="mt-2 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
