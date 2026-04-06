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

interface StudentOption {
  id: string;
  name: string;
  email: string;
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
  enrollments: Array<{
    id: string;
    student: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

interface ReplicationTemplate {
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location: string;
  modality: string;
  priceCents: number;
}

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function monthLabel(month: number, year: number) {
  return `${pad(month)}/${year}`;
}

function isInMonth(date: Date, month: number, year: number) {
  return date.getMonth() + 1 === month && date.getFullYear() === year;
}

function getTargetDatesForWeekday(month: number, year: number, weekday: number) {
  const list: Date[] = [];
  const cursor = new Date(`${year}-${pad(month)}-01T00:00:00`);
  while (cursor.getMonth() + 1 === month) {
    if (cursor.getDay() === weekday) {
      list.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return list;
}

export default function AdminSessionsClient({
  sessions,
  subjects,
  teachers,
  students
}: {
  sessions: SessionItem[];
  subjects: Subject[];
  teachers: Teacher[];
  students: StudentOption[];
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [replicateSourceMonth, setReplicateSourceMonth] = useState(new Date().getMonth() + 1);
  const [replicateSourceYear, setReplicateSourceYear] = useState(new Date().getFullYear());
  const [replicateTargetMonth, setReplicateTargetMonth] = useState(((new Date().getMonth() + 1) % 12) + 1);
  const [replicateTargetYear, setReplicateTargetYear] = useState(
    new Date().getMonth() + 1 === 12 ? new Date().getFullYear() + 1 : new Date().getFullYear()
  );
  const [replicateTeacherFilter, setReplicateTeacherFilter] = useState("");
  const [replicatePreview, setReplicatePreview] = useState<Array<ReplicationTemplate & { occurrences: number }>>([]);
  const [replicateFeedback, setReplicateFeedback] = useState<string | null>(null);
  const [replicateError, setReplicateError] = useState<string | null>(null);
  const [isReplicating, setIsReplicating] = useState(false);
  const [enrollingSessionId, setEnrollingSessionId] = useState<string | null>(null);
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);

  async function handleAdminEnroll(sessionId: string) {
    if (!enrollStudentId) return;
    setIsEnrolling(true);
    setEnrollError(null);
    try {
      const res = await fetch("/api/admin/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, studentId: enrollStudentId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEnrollError(data?.message ?? "Erro ao inscrever aluno.");
      } else {
        setEnrollingSessionId(null);
        setEnrollStudentId("");
        window.location.reload();
      }
    } catch {
      setEnrollError("Falha de conexão.");
    } finally {
      setIsEnrolling(false);
    }
  }

  function buildTemplatesFromSourceMonth() {
    const sourceSessions = sessions.filter((item) => {
      const startsAt = toDate(item.startsAt);
      const byMonth = item.status === "ATIVA" && isInMonth(startsAt, replicateSourceMonth, replicateSourceYear);
      const byTeacher = replicateTeacherFilter ? item.teacher.id === replicateTeacherFilter : true;
      return byMonth && byTeacher;
    });

    const templateMap = new Map<string, ReplicationTemplate>();
    sourceSessions.forEach((item) => {
      const startsAt = toDate(item.startsAt);
      const endsAt = toDate(item.endsAt);
      const startTime = `${pad(startsAt.getHours())}:${pad(startsAt.getMinutes())}`;
      const endTime = `${pad(endsAt.getHours())}:${pad(endsAt.getMinutes())}`;
      const weekDay = startsAt.getDay();

      const key = [
        item.subject.id,
        item.teacher.id,
        weekDay,
        startTime,
        endTime,
        item.location,
        item.modality,
        item.priceCents
      ].join("|");

      if (!templateMap.has(key)) {
        templateMap.set(key, {
          subjectId: item.subject.id,
          subjectName: item.subject.name,
          teacherId: item.teacher.id,
          teacherName: item.teacher.name,
          weekday: weekDay,
          startTime,
          endTime,
          location: item.location,
          modality: item.modality,
          priceCents: item.priceCents
        });
      }
    });

    return Array.from(templateMap.values());
  }

  function simulateReplication() {
    setReplicateError(null);
    setReplicateFeedback(null);

    if (
      replicateSourceMonth === replicateTargetMonth &&
      replicateSourceYear === replicateTargetYear
    ) {
      setReplicatePreview([]);
      setReplicateError("Selecione meses diferentes para origem e destino.");
      return;
    }

    const templates = buildTemplatesFromSourceMonth();
    if (templates.length === 0) {
      setReplicatePreview([]);
      setReplicateError("Nenhuma sessão ativa encontrada no mês de origem.");
      return;
    }

    const nextPreview = templates
      .map((template) => ({
        ...template,
        occurrences: getTargetDatesForWeekday(replicateTargetMonth, replicateTargetYear, template.weekday).length
      }))
      .filter((template) => template.occurrences > 0)
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName, "pt-BR", { sensitivity: "base" }));

    if (nextPreview.length === 0) {
      setReplicatePreview([]);
      setReplicateError("O mês de destino não possui datas compatíveis com os padrões da origem.");
      return;
    }

    setReplicatePreview(nextPreview);
    setReplicateFeedback(
      `Prévia pronta: ${nextPreview.length} padrão(ões) serão replicados de ${monthLabel(
        replicateSourceMonth,
        replicateSourceYear
      )} para ${monthLabel(replicateTargetMonth, replicateTargetYear)}.`
    );
  }

  async function replicateMonthlyPattern(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isReplicating) return;

    setReplicateError(null);
    setReplicateFeedback(null);

    if (
      replicateSourceMonth === replicateTargetMonth &&
      replicateSourceYear === replicateTargetYear
    ) {
      setReplicateError("Selecione meses diferentes para origem e destino.");
      return;
    }

    const templates = buildTemplatesFromSourceMonth();
    if (templates.length === 0) {
      setReplicateError("Nenhuma sessão ativa encontrada no mês de origem.");
      return;
    }

    const targetSessions = sessions.filter((item) => {
      const startsAt = toDate(item.startsAt);
      return isInMonth(startsAt, replicateTargetMonth, replicateTargetYear);
    });

    const occupiedByTeacher = new Set(
      targetSessions.map((item) => {
        const startsAtIso = toDate(item.startsAt).toISOString();
        const endsAtIso = toDate(item.endsAt).toISOString();
        return `${item.teacher.id}|${startsAtIso}|${endsAtIso}`;
      })
    );

    const requests: Array<Promise<Response>> = [];
    let skipped = 0;

    templates.forEach((template) => {
      const dates = getTargetDatesForWeekday(replicateTargetMonth, replicateTargetYear, template.weekday);
      const [startHour, startMinute] = template.startTime.split(":").map(Number);
      const [endHour, endMinute] = template.endTime.split(":").map(Number);

      dates.forEach((date) => {
        const startsAt = new Date(date);
        const endsAt = new Date(date);
        startsAt.setHours(startHour, startMinute, 0, 0);
        endsAt.setHours(endHour, endMinute, 0, 0);

        const startsAtIso = startsAt.toISOString();
        const endsAtIso = endsAt.toISOString();
        const teacherSlotKey = `${template.teacherId}|${startsAtIso}|${endsAtIso}`;

        if (occupiedByTeacher.has(teacherSlotKey)) {
          skipped += 1;
          return;
        }

        occupiedByTeacher.add(teacherSlotKey);
        requests.push(
          fetch("/api/admin/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subjectId: template.subjectId,
              teacherId: template.teacherId,
              startsAt: startsAtIso,
              endsAt: endsAtIso,
              location: template.location,
              modality: template.modality,
              priceCents: template.priceCents
            })
          })
        );
      });
    });

    if (requests.length === 0) {
      setReplicateError("Nenhuma sessão nova para criar (os horários do professor já existem no mês destino).");
      return;
    }

    setIsReplicating(true);
    const settled = await Promise.allSettled(requests);
    setIsReplicating(false);

    const okCount = settled.filter((item) => item.status === "fulfilled" && item.value.ok).length;
    const failCount = settled.length - okCount;

    if (failCount > 0) {
      setReplicateError(
        `Replicação parcial: ${okCount} criada(s), ${failCount} com erro e ${skipped} ignorada(s) por conflito de horário.`
      );
      return;
    }

    setReplicateFeedback(`Replicação concluída: ${okCount} sessão(ões) criada(s) e ${skipped} ignorada(s) por conflito.`);
    window.location.reload();
  }

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
      subjectId,
      teacherId,
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
        <div className="mt-4 grid gap-3 md:grid-cols-4">
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

      <form onSubmit={replicateMonthlyPattern} className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Replicar padrão de sessões entre meses</h2>
        <p className="mt-1 text-xs text-slate-500">
          Mantém professor + dia da semana + horário e replica todos os padrões ativos do mês de origem.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-sm text-slate-600">
            Mês origem
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={replicateSourceMonth}
              onChange={(event) => setReplicateSourceMonth(Number(event.target.value))}
            />
          </label>
          <label className="text-sm text-slate-600">
            Ano origem
            <input
              type="number"
              min={2020}
              max={2100}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={replicateSourceYear}
              onChange={(event) => setReplicateSourceYear(Number(event.target.value))}
            />
          </label>
          <label className="text-sm text-slate-600">
            Mês destino
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={replicateTargetMonth}
              onChange={(event) => setReplicateTargetMonth(Number(event.target.value))}
            />
          </label>
          <label className="text-sm text-slate-600">
            Ano destino
            <input
              type="number"
              min={2020}
              max={2100}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={replicateTargetYear}
              onChange={(event) => setReplicateTargetYear(Number(event.target.value))}
            />
          </label>
          <label className="text-sm text-slate-600 md:col-span-2">
            Professor (filtro opcional)
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={replicateTeacherFilter}
              onChange={(event) => setReplicateTeacherFilter(event.target.value)}
            >
              <option value="">Todos os professores</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={simulateReplication}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Simular replicação
          </button>
          <button
            type="submit"
            disabled={isReplicating}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isReplicating ? "Replicando..." : "Replicar sessões do mês"}
          </button>
        </div>

        {replicateFeedback && <p className="mt-3 text-sm text-emerald-700">{replicateFeedback}</p>}
        {replicateError && <p className="mt-3 text-sm text-rose-600">{replicateError}</p>}

        {replicatePreview.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prévia (exemplo)</p>
            <ul className="mt-2 space-y-1">
              {replicatePreview.slice(0, 8).map((item, index) => (
                <li key={`${item.teacherId}-${item.subjectId}-${index}`} className="text-sm text-slate-700">
                  {item.teacherName} • {item.subjectName} • {weekdayLabels[item.weekday]} • {item.startTime}-{item.endTime} • {item.occurrences} ocorrência(s)
                </li>
              ))}
            </ul>
            {replicatePreview.length > 8 && (
              <p className="mt-2 text-xs text-slate-400">Mostrando 8 de {replicatePreview.length} padrão(ões).</p>
            )}
          </div>
        )}
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Agenda</h2>
        {deleteError && <p className="mt-2 text-sm text-rose-600">{deleteError}</p>}

        {(() => {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const upcoming = sessions.filter((s) => new Date(s.startsAt) >= now);
          const past = sessions.filter((s) => new Date(s.startsAt) < now).reverse();

          function SessionRow({
            session,
            isNext
          }: {
            session: (typeof sessions)[number];
            isNext?: boolean;
          }) {
            const isPast = new Date(session.startsAt) < now;
            const hasStudents = session.enrollments.length > 0;
            const sortedEnrollments = [...session.enrollments].sort((a, b) =>
              a.student.name.localeCompare(b.student.name, "pt-BR", { sensitivity: "base" })
            );

            const cardBg = isPast
              ? "border-slate-100 bg-slate-50 opacity-75"
              : isNext
                ? "border-indigo-300 bg-indigo-50"
                : hasStudents
                  ? "border-indigo-100 bg-white"
                  : "border-slate-100 bg-white";

            return (
              <div className={`rounded-lg border p-3 ${cardBg}`}>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${isPast ? "text-slate-400" : "text-slate-900"}`}>
                      {session.subject.name}
                    </p>
                    {isNext && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Próxima
                      </span>
                    )}
                    {hasStudents && !isPast && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        {session.enrollments.length} aluno{session.enrollments.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {isPast && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                        Passada
                      </span>
                    )}
                    {session.status === "CANCELADA" && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-600">
                        Cancelada
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${isPast ? "text-slate-400" : "text-slate-500"}`}>
                    {new Date(session.startsAt).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit"
                    })}{" "}
                    {new Date(session.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {new Date(session.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className={`text-xs ${isPast ? "text-slate-400" : "text-slate-500"}`}>{session.teacher.name}</p>
                  {session.priceCents > 0 && (
                    <p className="text-xs text-slate-500">
                      Valor: R$ {Number(session.priceCents / 100).toFixed(2)}
                    </p>
                  )}
                  <div className={`mt-2 rounded-md p-2 ${isPast ? "bg-slate-100" : hasStudents ? "bg-indigo-50" : "bg-slate-50"}`}>
                    <p className={`text-xs font-semibold ${isPast ? "text-slate-400" : hasStudents ? "text-indigo-700" : "text-slate-700"}`}>
                      Inscritos ({sortedEnrollments.length})
                    </p>
                    {sortedEnrollments.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-400">Sem alunos inscritos.</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5">
                        {sortedEnrollments.map((enrollment) => (
                          <li key={enrollment.id} className={`text-xs ${isPast ? "text-slate-400" : "text-slate-600"}`}>
                            {enrollment.student.name}{" "}
                            <span className="text-slate-400">({enrollment.student.email})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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
                  {session.status === "ATIVA" && (
                    <button
                      onClick={() => {
                        setEnrollingSessionId(enrollingSessionId === session.id ? null : session.id);
                        setEnrollStudentId(students[0]?.id ?? "");
                        setEnrollError(null);
                      }}
                      className="rounded-md border border-indigo-200 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                    >
                      Inscrever aluno
                    </button>
                  )}
                </div>
                {enrollingSessionId === session.id && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-indigo-100 bg-indigo-50 p-3">
                    <label className="flex-1 text-xs text-slate-600">
                      Aluno
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={enrollStudentId}
                        onChange={(event) => setEnrollStudentId(event.target.value)}
                      >
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.name} ({student.email})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={isEnrolling || !enrollStudentId}
                      onClick={() => handleAdminEnroll(session.id)}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isEnrolling ? "Inscrevendo..." : "Confirmar"}
                    </button>
                    <button
                      onClick={() => { setEnrollingSessionId(null); setEnrollError(null); }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    {enrollError && <p className="w-full text-xs text-rose-600">{enrollError}</p>}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div className="mt-3 space-y-6">
              {upcoming.length === 0 && past.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma sessão cadastrada.</p>
              )}
              {upcoming.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Próximas sessões ({upcoming.length})
                  </p>
                  <div className="grid gap-3">
                    {upcoming.map((s, idx) => (
                      <SessionRow key={s.id} session={s} isNext={idx === 0} />
                    ))}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <details>
                  <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600">
                    Sessões passadas ({past.length})
                  </summary>
                  <div className="mt-2 grid gap-3">
                    {past.map((s) => (
                      <SessionRow key={s.id} session={s} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
