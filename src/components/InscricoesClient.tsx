"use client";

import { useState } from "react";

interface EnrollmentView {
  id: string;
  status: string;
  session: {
    id: string;
    startsAt: string | Date;
    endsAt: string | Date;
    subject: { name: string };
    teacher: { name: string };
  };
}

const CANCEL_WINDOW_HOURS = 48;

function canCancelUntil(startsAt: string | Date) {
  const start = new Date(startsAt).getTime();
  const diffMs = start - Date.now();
  return diffMs >= CANCEL_WINDOW_HOURS * 60 * 60 * 1000;
}

export default function InscricoesClient({ enrollments }: { enrollments: EnrollmentView[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleUnenroll(enrollmentId: string) {
    setLoadingId(enrollmentId);
    await fetch("/api/unenroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId })
    });
    window.location.reload();
  }

  return (
    <div className="grid gap-4">
      {enrollments.map((enrollment) => {
        const cancelAllowed = canCancelUntil(enrollment.session.startsAt);

        return (
          <div key={enrollment.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{enrollment.session.subject.name}</h3>
                <p className="text-sm text-slate-500">
                  {enrollment.session.teacher.name} • {new Date(enrollment.session.startsAt).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit"
                  })}{" "}
                  {new Date(enrollment.session.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} -{" "}
                  {new Date(enrollment.session.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs text-slate-400">Status: {enrollment.status}</p>
                {enrollment.status === "AGENDADO" && !cancelAllowed && (
                  <p className="text-xs text-amber-700">Desmarcação permitida apenas até 48h antes da aula.</p>
                )}
              </div>
              {enrollment.status === "AGENDADO" && (
                <button
                  onClick={() => handleUnenroll(enrollment.id)}
                  disabled={loadingId === enrollment.id || !cancelAllowed}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={!cancelAllowed ? "Desmarcação permitida apenas até 48h antes da aula" : undefined}
                >
                  {loadingId === enrollment.id ? "Desmarcando..." : "Desmarcar"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
