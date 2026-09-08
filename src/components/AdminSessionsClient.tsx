"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  students,
  pendingEditId,
  onPendingEditHandled
}: {
  sessions: SessionItem[];
  subjects: Subject[];
  teachers: Teacher[];
  students: StudentOption[];
  pendingEditId?: string | null;
  onPendingEditHandled?: () => void;
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("12:30");
  const [endTime, setEndTime] = useState("13:30");
  const [location, setLocation] = useState("Sala 1");
  const [modality, setModality] = useState("PRESENCIAL");
  // Vazio = usa o valor padrão da disciplina selecionada
  const [priceCentsInput, setPriceCentsInput] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [weekday, setWeekday] = useState(1);
  const [isCreatingMonthly, setIsCreatingMonthly] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [monthlyFeedback, setMonthlyFeedback] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [agendaMessage, setAgendaMessage] = useState<string | null>(null);
  const [cancelingSessionId, setCancelingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  // Filtros da agenda
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [pastVisible, setPastVisible] = useState(20);
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

  // Edit modal state
  const [editingSession, setEditingSession] = useState<SessionItem | null>(null);
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editModality, setEditModality] = useState("PRESENCIAL");
  const [editStatus, setEditStatus] = useState("ATIVA");
  const [editPriceCents, setEditPriceCents] = useState(0);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Unenroll state
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null);
  const [unenrollError, setUnenrollError] = useState<{ enrollmentId: string; message: string } | null>(null);

  function openEditModal(session: SessionItem) {
    const startsAt = toDate(session.startsAt);
    const endsAt = toDate(session.endsAt);
    setEditingSession(session);
    setEditSubjectId(session.subject.id);
    setEditTeacherId(session.teacher.id);
    setEditDate(
      `${startsAt.getFullYear()}-${pad(startsAt.getMonth() + 1)}-${pad(startsAt.getDate())}`
    );
    setEditStartTime(`${pad(startsAt.getHours())}:${pad(startsAt.getMinutes())}`);
    setEditEndTime(`${pad(endsAt.getHours())}:${pad(endsAt.getMinutes())}`);
    setEditLocation(session.location);
    setEditModality(session.modality);
    setEditStatus(session.status);
    setEditPriceCents(session.priceCents);
    setEditError(null);
  }

  // Open edit modal when calendar requests it
  useEffect(() => {
    if (!pendingEditId) return;
    const session = sessions.find((s) => s.id === pendingEditId);
    if (session) openEditModal(session);
    onPendingEditHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditId]);

  async function handleEditSave() {
    if (!editingSession || !editDate) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const startsAt = new Date(`${editDate}T${editStartTime}:00`);
      const endsAt = new Date(`${editDate}T${editEndTime}:00`);
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSession.id,
          subjectId: editSubjectId,
          teacherId: editTeacherId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          location: editLocation,
          modality: editModality,
          status: editStatus,
          priceCents: editPriceCents
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(data?.message ?? "Erro ao salvar sessão.");
      } else {
        setEditingSession(null);
        setAgendaMessage("Sessão atualizada com sucesso.");
        router.refresh();
      }
    } catch {
      setEditError("Falha de conexão.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleAdminUnenroll(enrollmentId: string) {
    const confirmed = window.confirm("Cancelar inscrição deste aluno e devolver o token?");
    if (!confirmed) return;
    setUnenrollingId(enrollmentId);
    setUnenrollError(null);
    try {
      const res = await fetch("/api/admin/unenroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUnenrollError({ enrollmentId, message: data?.message ?? "Erro ao cancelar inscrição." });
      } else {
        setAgendaMessage("Inscrição cancelada e token devolvido.");
        router.refresh();
      }
    } catch {
      setUnenrollError({ enrollmentId, message: "Falha de conexão." });
    } finally {
      setUnenrollingId(null);
    }
  }

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
        setAgendaMessage("Aluno inscrito com sucesso.");
        router.refresh();
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
      if (okCount > 0) {
        router.refresh();
      }
      return;
    }

    setReplicateFeedback(`Replicação concluída: ${okCount} sessão(ões) criada(s) e ${skipped} ignorada(s) por conflito.`);
    router.refresh();
  }

  // Preço das novas sessões: campo vazio usa o valor padrão da disciplina selecionada
  function resolvePriceCents() {
    const trimmed = priceCentsInput.trim();
    if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
      return Math.max(0, Math.round(Number(trimmed)));
    }
    const subject = subjects.find((item) => item.id === subjectId);
    return subject?.defaultPriceCents ?? 0;
  }

  async function createSessions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date || isCreating) return;

    setIsCreating(true);
    setCreateError(null);
    setCreateFeedback(null);

    try {
      const startDate = new Date(`${date}T${startTime}:00`);
      const endDate = new Date(`${date}T${endTime}:00`);

      const payloadBase = {
        subjectId,
        teacherId,
        location,
        modality,
        priceCents: resolvePriceCents()
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

      const settled = await Promise.allSettled(requests);
      const okCount = settled.filter((item) => item.status === "fulfilled" && item.value.ok).length;
      const failCount = settled.length - okCount;

      if (failCount > 0) {
        setCreateError(`${okCount} sessão(ões) criada(s) e ${failCount} com erro. Verifique a agenda antes de tentar novamente.`);
      } else {
        setCreateFeedback(`${okCount} sessão(ões) criada(s) com sucesso.`);
      }
      if (okCount > 0) {
        router.refresh();
      }
    } catch {
      setCreateError("Falha de conexão. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  }

  async function cancelSession(id: string) {
    setCancelingSessionId(id);
    setDeleteError(null);
    setAgendaMessage(null);
    try {
      const response = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "CANCELADA" })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setDeleteError(data?.message ?? "Não foi possível cancelar a sessão.");
        return;
      }
      setAgendaMessage("Sessão cancelada com sucesso.");
      router.refresh();
    } catch {
      setDeleteError("Falha de conexão. Tente novamente.");
    } finally {
      setCancelingSessionId(null);
    }
  }

  async function deleteSession(id: string) {
    const confirmed = window.confirm("Excluir esta sessão? Essa ação não pode ser desfeita.");
    if (!confirmed) return;
    setDeletingSessionId(id);
    setDeleteError(null);
    setAgendaMessage(null);
    try {
      const response = await fetch(`/api/admin/sessions?id=${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDeleteError(data?.message ?? "Não foi possível excluir a sessão.");
        return;
      }
      setAgendaMessage(
        data?.canceled === true && data?.message ? data.message : "Sessão excluída com sucesso."
      );
      router.refresh();
    } catch {
      setDeleteError("Falha de conexão. Tente novamente.");
    } finally {
      setDeletingSessionId(null);
    }
  }

  async function createMonthlySessions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!month || !year || isCreatingMonthly) return;

    setIsCreatingMonthly(true);
    setMonthlyError(null);
    setMonthlyFeedback(null);

    try {
      const startDate = new Date(`${year}-${String(month).padStart(2, "0")}-01T${startTime}:00`);
      const dates: Date[] = [];

      const current = new Date(startDate);
      while (current.getMonth() + 1 === month) {
        if (current.getDay() === weekday) {
          dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }

      if (dates.length === 0) {
        setMonthlyError("Nenhuma data encontrada para o mês e dia da semana selecionados.");
        return;
      }

      const payloadBase = {
        subjectId,
        teacherId,
        location,
        modality,
        priceCents: resolvePriceCents()
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

      const settled = await Promise.allSettled(requests);
      const okCount = settled.filter((item) => item.status === "fulfilled" && item.value.ok).length;
      const failCount = settled.length - okCount;

      if (failCount > 0) {
        setMonthlyError(`${okCount} sessão(ões) criada(s) e ${failCount} com erro. Verifique a agenda antes de tentar novamente.`);
      } else {
        setMonthlyFeedback(`${okCount} sessão(ões) criada(s) com sucesso.`);
      }
      if (okCount > 0) {
        router.refresh();
      }
    } catch {
      setMonthlyError("Falha de conexão. Tente novamente.");
    } finally {
      setIsCreatingMonthly(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Edit session modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Editar sessão</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {editingSession.subject.name} — {new Date(editingSession.startsAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-600">
                Disciplina
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={editSubjectId}
                  onChange={(e) => setEditSubjectId(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Professor
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={editTeacherId}
                  onChange={(e) => setEditTeacherId(e.target.value)}
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Data
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </label>
              <label className="text-sm text-slate-600">
                Status
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="ATIVA">Ativa</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Início
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
              </label>
              <label className="text-sm text-slate-600">
                Fim
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                />
              </label>
              <label className="text-sm text-slate-600">
                Local
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
              </label>
              <label className="text-sm text-slate-600">
                Modalidade
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={editModality}
                  onChange={(e) => setEditModality(e.target.value)}
                >
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="ONLINE">Online</option>
                </select>
              </label>
              <label className="text-sm text-slate-600 md:col-span-2">
                Valor (centavos)
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={editPriceCents}
                  onChange={(e) => setEditPriceCents(Number(e.target.value))}
                />
                <span className="mt-0.5 block text-xs text-slate-400">
                  Ex.: 5000 = R$&nbsp;50,00. Use 0 para gratuito.
                </span>
              </label>
            </div>
            {editError && <p className="mt-3 text-sm text-rose-600">{editError}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={isSavingEdit}
                onClick={handleEditSave}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingEdit ? "Salvando..." : "Salvar alterações"}
              </button>
              <button
                onClick={() => setEditingSession(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
            <span className="mt-1 block text-xs text-slate-400">
              Deixe o preço vazio para usar o valor padrão da disciplina.
            </span>
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
            Valor (centavos)
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={priceCentsInput}
              onChange={(event) => setPriceCentsInput(event.target.value)}
              placeholder={`Padrão: ${subjects.find((item) => item.id === subjectId)?.defaultPriceCents ?? 0}`}
            />
            <span className="mt-1 block text-xs text-slate-400">
              Vazio = valor padrão da disciplina. Ex.: 5000 = R$ 50,00.
            </span>
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
        <button
          disabled={isCreating}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreating ? "Criando..." : "Criar sessões"}
        </button>
        {createError && <p className="mt-3 text-sm text-rose-600">{createError}</p>}
        {createFeedback && <p className="mt-3 text-sm text-emerald-700">{createFeedback}</p>}
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
          Serão criadas sessões em todas as datas do mês que caem no dia selecionado. Usa a disciplina, o professor,
          o local e o preço do formulário acima.
        </p>
        <button
          disabled={isCreatingMonthly}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreatingMonthly ? "Gerando..." : "Gerar sessões do mês"}
        </button>
        {monthlyError && <p className="mt-3 text-sm text-rose-600">{monthlyError}</p>}
        {monthlyFeedback && <p className="mt-3 text-sm text-emerald-700">{monthlyFeedback}</p>}
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
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <label className="text-xs text-slate-600">
            Professor
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filterTeacherId}
              onChange={(event) => {
                setFilterTeacherId(event.target.value);
                setPastVisible(20);
              }}
            >
              <option value="">Todos os professores</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Disciplina
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filterSubjectId}
              onChange={(event) => {
                setFilterSubjectId(event.target.value);
                setPastVisible(20);
              }}
            >
              <option value="">Todas as disciplinas</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Data
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filterDate}
              onChange={(event) => {
                setFilterDate(event.target.value);
                setPastVisible(20);
              }}
            />
          </label>
          {(filterTeacherId || filterSubjectId || filterDate) && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setFilterTeacherId("");
                  setFilterSubjectId("");
                  setFilterDate("");
                  setPastVisible(20);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
        {agendaMessage && <p className="mt-2 text-sm text-emerald-700">{agendaMessage}</p>}
        {deleteError && <p className="mt-2 text-sm text-rose-600">{deleteError}</p>}

        {(() => {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const filteredSessions = sessions.filter((s) => {
            if (filterTeacherId && s.teacher.id !== filterTeacherId) return false;
            if (filterSubjectId && s.subject.id !== filterSubjectId) return false;
            if (filterDate) {
              const startsAt = toDate(s.startsAt);
              const dateKey = `${startsAt.getFullYear()}-${pad(startsAt.getMonth() + 1)}-${pad(startsAt.getDate())}`;
              if (dateKey !== filterDate) return false;
            }
            return true;
          });
          const upcoming = filteredSessions.filter((s) => new Date(s.startsAt) >= now);
          const past = filteredSessions.filter((s) => new Date(s.startsAt) < now).reverse();
          const visiblePast = past.slice(0, pastVisible);

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
                      month: "2-digit",
                      timeZone: "America/Sao_Paulo"
                    })}{" "}
                    {new Date(session.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} -{" "}
                    {new Date(session.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                  </p>
                  <p className={`text-xs ${isPast ? "text-slate-400" : "text-slate-500"}`}>{session.teacher.name}</p>
                  {session.priceCents > 0 && (
                    <p className="text-xs text-slate-500">
                      Valor: {formatCurrency(session.priceCents)}
                    </p>
                  )}
                  <div className={`mt-2 rounded-md p-2 ${isPast ? "bg-slate-100" : hasStudents ? "bg-indigo-50" : "bg-slate-50"}`}>
                    <p className={`text-xs font-semibold ${isPast ? "text-slate-400" : hasStudents ? "text-indigo-700" : "text-slate-700"}`}>
                      Inscritos ({sortedEnrollments.length})
                    </p>
                    {sortedEnrollments.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-400">Sem alunos inscritos.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {sortedEnrollments.map((enrollment) => (
                          <li key={enrollment.id} className={`flex items-center justify-between gap-2 text-xs ${isPast ? "text-slate-400" : "text-slate-600"}`}>
                            <span>
                              {enrollment.student.name}{" "}
                              <span className="text-slate-400">({enrollment.student.email})</span>
                            </span>
                            {!isPast && (
                              <button
                                disabled={unenrollingId === enrollment.id}
                                onClick={() => handleAdminUnenroll(enrollment.id)}
                                className="shrink-0 rounded border border-rose-200 px-1.5 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                              >
                                {unenrollingId === enrollment.id ? "..." : "Cancelar inscrição"}
                              </button>
                            )}
                            {unenrollError?.enrollmentId === enrollment.id && (
                              <span className="text-rose-600">{unenrollError.message}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => openEditModal(session)}
                    className="rounded-md border border-indigo-200 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
                  >
                    Editar
                  </button>
                  {session.status === "ATIVA" && (
                    <button
                      disabled={cancelingSessionId === session.id}
                      onClick={() => cancelSession(session.id)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {cancelingSessionId === session.id ? "Cancelando..." : "Cancelar"}
                    </button>
                  )}
                  <button
                    disabled={deletingSessionId === session.id}
                    onClick={() => deleteSession(session.id)}
                    className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {deletingSessionId === session.id ? "Excluindo..." : "Excluir"}
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
                <p className="text-sm text-slate-500">
                  {sessions.length === 0
                    ? "Nenhuma sessão cadastrada."
                    : "Nenhuma sessão encontrada com os filtros atuais."}
                </p>
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
                    {visiblePast.map((s) => (
                      <SessionRow key={s.id} session={s} />
                    ))}
                  </div>
                  {past.length > pastVisible && (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        Mostrando {visiblePast.length} de {past.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPastVisible((prev) => prev + 20)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Mostrar mais
                      </button>
                    </div>
                  )}
                </details>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
