"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EnrollmentRow {
  id: string;
  student: { id: string; name: string };
  status: string;
  attendance?: { status: string } | null;
}

const statuses = ["PRESENTE", "ATRASADO", "AUSENTE"] as const;

export default function AttendanceClient({
  sessionId,
  enrollments
}: {
  sessionId: string;
  enrollments: EnrollmentRow[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function markAttendance(enrollmentId: string, status: string) {
    setLoadingId(enrollmentId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, status, note: notes[enrollmentId] })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data?.message ?? "Não foi possível marcar a presença.");
        return;
      }
      setSuccessMessage("Presença registrada com sucesso.");
      router.refresh();
    } catch (error) {
      setErrorMessage("Falha de conexão ao marcar presença. Tente novamente.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Lista de chamada</h2>
        {errorMessage && (
          <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
        )}
        {successMessage && (
          <p className="mt-2 text-sm text-emerald-600">{successMessage}</p>
        )}
      </div>
      <div className="grid gap-3">
        {enrollments.length === 0 && (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
            Nenhum aluno inscrito nesta sessão.
          </div>
        )}
        {enrollments.map((enrollment) => (
          <div key={enrollment.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{enrollment.student.name}</p>
                <p className="text-xs text-slate-500">Status inscrição: {enrollment.status}</p>
                {enrollment.attendance && (
                  <p className="text-xs text-slate-500">Presença: {enrollment.attendance.status}</p>
                )}
              </div>
              <input
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                placeholder="Observação"
                value={notes[enrollment.id] ?? ""}
                onChange={(event) =>
                  setNotes((prev) => ({ ...prev, [enrollment.id]: event.target.value }))
                }
              />
              <div className="flex flex-wrap gap-2">
                {statuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => markAttendance(enrollment.id, status)}
                    disabled={loadingId === enrollment.id}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
