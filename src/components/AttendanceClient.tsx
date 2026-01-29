"use client";

import { useState } from "react";

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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function markAttendance(enrollmentId: string, status: string) {
    setLoadingId(enrollmentId);
    await fetch("/api/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId, status, note: notes[enrollmentId] })
    });
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Lista de chamada</h2>
        <p className="text-sm text-slate-500">Sessão {sessionId}</p>
      </div>
      <div className="grid gap-3">
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
