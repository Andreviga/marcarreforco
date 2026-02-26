"use client";

import { useState } from "react";
import { format } from "date-fns";

interface SessionItem {
  id: string;
  startsAt: string | Date;
  endsAt: string | Date;
  location: string;
  modality: string;
  priceCents: number;
  status: string;
  subject: { name: string };
  teacher: { name: string };
}

interface EnrollmentItem {
  id: string;
  sessionId: string;
  status: string;
}

const CANCEL_WINDOW_HOURS = 48;

function canCancelUntil(startsAt: string | Date) {
  const start = new Date(startsAt).getTime();
  const diffMs = start - Date.now();
  return diffMs >= CANCEL_WINDOW_HOURS * 60 * 60 * 1000;
}

export default function AgendaClient({
  sessions,
  enrollments
}: {
  sessions: SessionItem[];
  enrollments: EnrollmentItem[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const enrolledMap = new Map(enrollments.map((enr) => [enr.sessionId, enr]));

  function getHelpHint(message: string) {
    const normalized = message.toLowerCase();
    if (normalized.includes("série")) {
      return "Verifique sua série no perfil ou escolha uma aula compatível com o seu ano escolar.";
    }
    if (normalized.includes("turma")) {
      return "Escolha uma aula da sua turma ou peça ao suporte para revisar seu cadastro.";
    }
    if (normalized.includes("créditos")) {
      return "Compre um pacote em Pagamentos ou aplique créditos pendentes antes de tentar novamente.";
    }
    if (normalized.includes("fora do prazo") || normalized.includes("já começou")) {
      return "Selecione uma sessão futura para agendar.";
    }
    if (normalized.includes("48 horas") || normalized.includes("48h")) {
      return "Você pode desmarcar até 48 horas antes do início da aula.";
    }
    if (normalized.includes("não está disponível")) {
      return "A sessão pode ter sido cancelada. Atualize a agenda e tente outra opção.";
    }
    return null;
  }

  async function handleEnroll(sessionId: string) {
    setLoadingId(sessionId);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data?.message ?? "Não foi possível agendar a sessão.");
        setLoadingId(null);
        return;
      }
      window.location.reload();
    } catch {
      setErrorMessage("Falha de conexão ao agendar. Tente novamente.");
      setLoadingId(null);
    }
  }

  async function handleUnenroll(enrollmentId: string) {
    setLoadingId(enrollmentId);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/unenroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data?.message ?? "Não foi possível desmarcar a sessão.");
        setLoadingId(null);
        return;
      }

      window.location.reload();
    } catch {
      setErrorMessage("Falha de conexão ao desmarcar. Tente novamente.");
      setLoadingId(null);
    }
  }

  const filtered = sessions.filter((session) => {
    const subjectMatch = filterSubject
      ? session.subject.name.toLowerCase().includes(filterSubject.toLowerCase())
      : true;
    const teacherMatch = filterTeacher
      ? session.teacher.name.toLowerCase().includes(filterTeacher.toLowerCase())
      : true;
    const locationMatch = filterLocation
      ? session.location.toLowerCase().includes(filterLocation.toLowerCase())
      : true;
    const dateMatch = filterDate
      ? format(new Date(session.startsAt), "yyyy-MM-dd") === filterDate
      : true;
    return subjectMatch && teacherMatch && locationMatch && dateMatch;
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Filtros</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Disciplina"
            value={filterSubject}
            onChange={(event) => setFilterSubject(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Professor"
            value={filterTeacher}
            onChange={(event) => setFilterTeacher(event.target.value)}
          />
          <input
            type="date"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filterDate}
            onChange={(event) => setFilterDate(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Unidade/Local"
            value={filterLocation}
            onChange={(event) => setFilterLocation(event.target.value)}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Dica: para desmarcar, use o botão <strong>Desmarcar</strong> na própria aula agendada. O cancelamento é permitido até 48h antes.
        </p>
        {errorMessage && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-sm font-medium text-red-700">{errorMessage}</p>
            {getHelpHint(errorMessage) && (
              <p className="mt-1 text-xs text-red-600">{getHelpHint(errorMessage)}</p>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-4">
        {filtered.map((session) => {
          const enrollment = enrolledMap.get(session.id);
          const cancelAllowed = canCancelUntil(session.startsAt);

          return (
            <div key={session.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{session.subject.name}</h3>
                  <p className="text-sm text-slate-500">
                    {session.teacher.name} • {new Date(session.startsAt).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit"
                    })}{" "}
                    {new Date(session.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {new Date(session.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-sm text-slate-500">{session.modality === "ONLINE" ? "Online" : session.location}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">1 crédito</span>
                  {enrollment?.status === "AGENDADO" ? (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => handleUnenroll(enrollment.id)}
                        disabled={loadingId === enrollment.id || !cancelAllowed}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        title={!cancelAllowed ? "Desmarcação permitida apenas até 48h antes da aula" : undefined}
                      >
                        {loadingId === enrollment.id ? "Desmarcando..." : "Desmarcar"}
                      </button>
                      <span className="text-[11px] text-slate-500">
                        {cancelAllowed
                          ? "Agendado. Você pode desmarcar até 48h antes da aula."
                          : "Agendado. Prazo de desmarcação encerrado (menos de 48h)."}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => handleEnroll(session.id)}
                        disabled={loadingId === session.id}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {loadingId === session.id ? "Agendando..." : "Agendar"}
                      </button>
                      <span className="text-[11px] text-slate-500">Ao agendar, 1 crédito será reservado automaticamente.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
