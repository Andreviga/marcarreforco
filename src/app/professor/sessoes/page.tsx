import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import Link from "next/link";
import { startOfDay } from "date-fns";
import MonthlyCalendarClient from "@/components/MonthlyCalendarClient";

const CLASS_START_LABEL = "12:30";
const CLASS_END_LABEL = "13:20";
const SCHOOL_TIMEZONE = "America/Sao_Paulo";

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
    meta: `${CLASS_START_LABEL} - ${CLASS_END_LABEL}`,
    href: `/professor/sessoes/${item.id}`,
    status: item.status
  }));

  return (
    <AppShell title="Sessões" subtitle="Sua agenda de reforços (horário fixo 12:30 às 13:20)" role="PROFESSOR">
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
                      month: "2-digit",
                      timeZone: SCHOOL_TIMEZONE
                    })}{" "}
                    {CLASS_START_LABEL} - {CLASS_END_LABEL}
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
