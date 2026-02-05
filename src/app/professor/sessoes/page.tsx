import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import Link from "next/link";
import { startOfDay } from "date-fns";
import MonthlyCalendarClient from "@/components/MonthlyCalendarClient";

export default async function ProfessorSessoesPage() {
  const session = await requireRole(["PROFESSOR"]);

  const now = startOfDay(new Date());
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const sessions = await prisma.session.findMany({
    where: {
      teacherId: session.user.id
    },
    include: { subject: true },
    orderBy: { startsAt: "asc" }
  });

  const calendarItems = sessions.map((item) => ({
    id: item.id,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    title: item.subject.name,
    subtitle: item.status,
    href: `/professor/sessoes/${item.id}`,
    status: item.status
  }));

  return (
    <AppShell title="Sessões" subtitle="Sua agenda de reforços" role="PROFESSOR">
      <div className="space-y-6">
        <MonthlyCalendarClient month={month} year={year} items={calendarItems} />
        <div className="grid gap-4">
          {sessions.length === 0 ? (
            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
              Nenhuma sessão encontrada.
            </div>
          ) : (
            sessions.map((item) => (
              <Link
                key={item.id}
                href={`/professor/sessoes/${item.id}`}
                className="rounded-xl bg-white p-4 shadow-sm hover:bg-slate-50"
              >
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-slate-900">{item.subject.name}</h3>
                  <p className="text-sm text-slate-500">
                    {new Date(item.startsAt).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit"
                    })}{" "}
                    {new Date(item.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {new Date(item.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-slate-400">Status: {item.status}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
