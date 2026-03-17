import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import Link from "next/link";
import MonthlyCalendarClient from "@/components/MonthlyCalendarClient";

export default async function ProfessorSessoesPage() {
  const session = await requireRole(["PROFESSOR"]);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const sessions = await prisma.session.findMany({
    where: { teacherId: session.user.id },
    include: {
      subject: true,
      enrollments: {
        where: { status: "AGENDADO" },
        select: { id: true, student: { select: { name: true } } }
      }
    },
    orderBy: { startsAt: "asc" }
  });

  const upcoming = sessions.filter((s) => new Date(s.startsAt) >= now);
  const past = sessions.filter((s) => new Date(s.startsAt) < now).reverse();

  const calendarItems = sessions.map((item) => ({
    id: item.id,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    title: item.subject.name,
    subtitle: item.status,
    href: `/professor/sessoes/${item.id}`,
    status: item.status,
    hasEnrollments: item.enrollments.length > 0
  }));

  function SessionCard({
    item,
    isNext,
    isPast
  }: {
    item: (typeof sessions)[number];
    isNext?: boolean;
    isPast?: boolean;
  }) {
    const startsAt = new Date(item.startsAt);
    const endsAt = new Date(item.endsAt);
    const enrollCount = item.enrollments.length;

    return (
      <Link
        href={`/professor/sessoes/${item.id}`}
        className={`rounded-xl p-4 shadow-sm hover:opacity-90 transition-opacity ${
          isPast
            ? "bg-slate-50 border border-slate-100"
            : isNext
              ? "bg-indigo-50 border border-indigo-200"
              : enrollCount > 0
                ? "bg-white border border-indigo-100"
                : "bg-white"
        }`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3
              className={`text-lg font-semibold ${
                isPast ? "text-slate-400" : "text-slate-900"
              }`}
            >
              {item.subject.name}
            </h3>
            {isNext && (
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                Próxima
              </span>
            )}
            {enrollCount > 0 && !isNext && !isPast && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700">
                {enrollCount} aluno{enrollCount > 1 ? "s" : ""}
              </span>
            )}
            {isNext && enrollCount > 0 && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700">
                {enrollCount} aluno{enrollCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className={`text-sm ${isPast ? "text-slate-400" : "text-slate-500"}`}>
            {startsAt.toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit"
            })}{" "}
            {startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} -{" "}
            {endsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className={`text-xs ${isPast ? "text-slate-400" : "text-slate-400"}`}>
            Status: {item.status}
            {isPast && enrollCount > 0 && ` • ${enrollCount} aluno${enrollCount > 1 ? "s" : ""}`}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <AppShell title="Sessões" subtitle="Sua agenda de reforços" role="PROFESSOR">
      <div className="space-y-6">
        <MonthlyCalendarClient month={month} year={year} items={calendarItems} />

        {sessions.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
            Nenhuma sessão encontrada.
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Próximas sessões
                </h2>
                <div className="grid gap-3">
                  {upcoming.map((item, idx) => (
                    <SessionCard key={item.id} item={item} isNext={idx === 0} />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer select-none text-sm font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600">
                  Sessões passadas ({past.length})
                </summary>
                <div className="mt-3 grid gap-3">
                  {past.map((item) => (
                    <SessionCard key={item.id} item={item} isPast />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
