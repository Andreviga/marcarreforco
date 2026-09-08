"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export default function InscricoesClient({ enrollments }: { enrollments: EnrollmentView[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orderedEnrollments = [...enrollments].sort((a, b) => {
    const aStarts = new Date(a.session.startsAt);
    const bStarts = new Date(b.session.startsAt);
    const aUpcoming = aStarts >= today;
    const bUpcoming = bStarts >= today;

    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;
    if (aUpcoming && bUpcoming) return aStarts.getTime() - bStarts.getTime();
    return bStarts.getTime() - aStarts.getTime();
  });

  async function handleUnenroll(enrollmentId: string) {
    setLoadingId(enrollmentId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/unenroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data?.message ?? "Não foi possível desmarcar a sessão.");
        return;
      }
      // A API informa se o crédito foi devolvido ou não (regra das 48h).
      setSuccessMessage(data?.message ?? "Sessão desmarcada com sucesso.");
      router.refresh();
    } catch (error) {
      setErrorMessage("Falha de conexão ao desmarcar. Tente novamente.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="grid gap-4">
      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
      {successMessage && (
        <p className="text-sm text-emerald-600">{successMessage}</p>
      )}
      {orderedEnrollments.length === 0 && (
        <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
          Nenhuma inscrição encontrada.
        </div>
      )}
      {orderedEnrollments.map((enrollment) => (
        <div key={enrollment.id} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {enrollment.session.subject.name}
              </h3>
              <p className="text-sm text-slate-500">
                {enrollment.session.teacher.name} • {new Date(enrollment.session.startsAt).toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                  timeZone: "America/Sao_Paulo"
                })}{" "}
                {new Date(enrollment.session.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} -{" "}
                {new Date(enrollment.session.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
              </p>
              <p className="text-xs text-slate-400">Status: {enrollment.status}</p>
            </div>
            {enrollment.status === "AGENDADO" && (
              <button
                onClick={() => handleUnenroll(enrollment.id)}
                disabled={loadingId === enrollment.id}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {loadingId === enrollment.id ? "Desmarcando..." : "Desmarcar"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
