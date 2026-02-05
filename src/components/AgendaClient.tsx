"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";

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
    } catch (error) {
      setErrorMessage("Falha de conexão ao agendar. Tente novamente.");
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
        {errorMessage && (
          <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
        )}
      </div>
      <div className="grid gap-4">
        {filtered.map((session) => {
          const enrollment = enrolledMap.get(session.id);
          return (
            <div key={session.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {session.subject.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {session.teacher.name} • {format(new Date(session.startsAt), "dd/MM HH:mm")} - {format(new Date(session.endsAt), "HH:mm")}
                  </p>
                  <p className="text-sm text-slate-500">
                    {session.modality === "ONLINE" ? "Online" : session.location}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">
                    Valor: {formatCurrency(session.priceCents)}
                  </span>
                  {enrollment?.status === "AGENDADO" ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                      Agendado
                    </span>
                  ) : (
                    <button
                      onClick={() => handleEnroll(session.id)}
                      disabled={loadingId === session.id}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                    >
                      {loadingId === session.id ? "Agendando..." : "Agendar"}
                    </button>
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
