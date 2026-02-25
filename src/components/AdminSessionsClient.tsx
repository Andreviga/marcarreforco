"use client";

import { useState } from "react";

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
  const [startTime, setStartTime] = useState("12:30");
  const [endTime, setEndTime] = useState("13:30");
  const [location, setLocation] = useState("Sala 1");
  const [modality, setModality] = useState("PRESENCIAL");
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [weekday, setWeekday] = useState(1);
  const [monthlySubjectId, setMonthlySubjectId] = useState(subjects[0]?.id ?? "");
  const [monthlyTeacherId, setMonthlyTeacherId] = useState(teachers[0]?.id ?? "");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function createSessions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) return;

    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = new Date(`${date}T${endTime}:00`);

    const payloadBase = {
      subjectId,
      teacherId,
      location,
      modality
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

  async function deleteSession(id: string) {
    const confirmed = window.confirm("Excluir esta sessão? Essa ação não pode ser desfeita.");
    if (!confirmed) return;
    setDeleteError(null);
    const response = await fetch(`/api/admin/sessions?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setDeleteError(data?.message ?? "Não foi possível excluir a sessão.");
      return;
    }
    window.location.reload();
  }

  async function createMonthlySessions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!month || !year) return;

    const startDate = new Date(`${year}-${String(month).padStart(2, "0")}-01T${startTime}:00`);
    const endDate = new Date(`${year}-${String(month).padStart(2, "0")}-01T${endTime}:00`);
    const dates: Date[] = [];

    const current = new Date(startDate);
    while (current.getMonth() + 1 === month) {
      if (current.getDay() === weekday) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    const payloadBase = {
      subjectId: monthlySubjectId,
      teacherId: monthlyTeacherId,
      location,
      modality
    };

    const requests = dates.map((date) => {
      const startsAt = new Date(date);
      const endsAt = new Date(date);
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);
      startsAt.setHours(startHour, startMinute, 0, 0);
      endsAt.setHours(endHour, endMinute, 0, 0);

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
              }}
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-400">Use o valor padrão da disciplina para preço automático.</span>
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
            <span className="mt-1 block text-xs text-slate-400">Escolha o professor responsável pela sessão.</span>
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
            <span className="mt-1 block text-xs text-slate-400">Data da primeira sessão.</span>
          </label>
          <label className="text-sm text-slate-600">
            Início
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-400">Horário de início (ex.: 13:30).</span>
          </label>
          <label className="text-sm text-slate-600">
            Fim
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-400">Horário de término (ex.: 14:30).</span>
          </label>
          <label className="text-sm text-slate-600">
            Local
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ex.: Sala 1"
            />
            <span className="mt-1 block text-xs text-slate-400">Sala, laboratório ou link da aula.</span>
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
            <span className="mt-1 block text-xs text-slate-400">Presencial ou online.</span>
          </label>
          <label className="text-sm text-slate-600">
            Repetir por (semanas)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              min={1}
              value={repeatWeeks}
              onChange={(event) => setRepeatWeeks(Number(event.target.value))}
              placeholder="Ex.: 4"
            />
            <span className="mt-1 block text-xs text-slate-400">Cria 1 sessão por semana.</span>
          </label>
        </div>
        <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
          Criar sessões
        </button>
      </form>

      <form onSubmit={createMonthlySessions} className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Gerar sessões por mês</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <label className="text-sm text-slate-600">
            Disciplina
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={monthlySubjectId}
              onChange={(event) => setMonthlySubjectId(event.target.value)}
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
              value={monthlyTeacherId}
              onChange={(event) => setMonthlyTeacherId(event.target.value)}
            >
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Mês
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              placeholder="Ex.: 3"
            />
            <span className="mt-1 block text-xs text-slate-400">1 a 12.</span>
          </label>
          <label className="text-sm text-slate-600">
            Ano
            <input
              type="number"
              min={2020}
              max={2100}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              placeholder="Ex.: 2026"
            />
            <span className="mt-1 block text-xs text-slate-400">Ano completo.</span>
          </label>
          <label className="text-sm text-slate-600">
            Dia da semana
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={weekday}
              onChange={(event) => setWeekday(Number(event.target.value))}
            >
              <option value={1}>Segunda</option>
              <option value={2}>Terça</option>
              <option value={3}>Quarta</option>
              <option value={4}>Quinta</option>
              <option value={5}>Sexta</option>
              <option value={6}>Sábado</option>
              <option value={0}>Domingo</option>
            </select>
            <span className="mt-1 block text-xs text-slate-400">Gera sessões em todas as semanas.</span>
          </label>
          <label className="text-sm text-slate-600">
            Horário
            <div className="mt-1 flex gap-2">
              <input
                type="time"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
              <input
                type="time"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
            <span className="mt-1 block text-xs text-slate-400">Inicio e fim da aula.</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Serão criadas sessões em todas as datas do mês que caem no dia selecionado.
        </p>
        <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
          Gerar sessões do mês
        </button>
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Agenda</h2>
        {deleteError && <p className="mt-2 text-sm text-rose-600">{deleteError}</p>}
        <div className="mt-3 grid gap-3">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-slate-900">{session.subject.name}</p>
                <p className="text-xs text-slate-500">
                  {new Date(session.startsAt).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit"
                  })}{" "}
                  {new Date(session.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} -{" "}
                  {new Date(session.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs text-slate-500">{session.teacher.name}</p>
                {session.priceCents > 0 && (
                  <p className="text-xs text-slate-500">Valor: R$ {Number(session.priceCents / 100).toFixed(2)}</p>
                )}
                <p className="text-xs text-slate-400">Status: {session.status}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {session.status === "ATIVA" && (
                  <button
                    onClick={() => cancelSession(session.id)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={() => deleteSession(session.id)}
                  className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
