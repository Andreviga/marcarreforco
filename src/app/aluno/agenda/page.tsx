import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AgendaClient from "@/components/AgendaClient";
import MonthlyCalendarClient from "@/components/MonthlyCalendarClient";
import Link from "next/link";
import RulesBanner from "@/components/RulesBanner";
import { getBalancesForStudent } from "@/lib/credits";

export default async function AlunoAgendaPage() {
  const session = await requireRole(["ALUNO"]);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const sessions = await prisma.session.findMany({
    where: { status: "ATIVA" },
    include: { subject: true, teacher: true },
    orderBy: { startsAt: "asc" }
  });

  const balances = await getBalancesForStudent(session.user.id);

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: session.user.id },
    include: { session: true }
  });


  const enrollmentBySessionId = new Map(enrollments.map((enrollment) => [enrollment.sessionId, enrollment.status]));

  const calendarItems = sessions.map((item) => ({
    id: item.id,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    title: item.subject.name,
    subtitle: `${item.teacher.name} • ${item.modality === "ONLINE" ? "Online" : item.location}`,
    meta: enrollmentBySessionId.get(item.id) === "AGENDADO" ? "✅ Agendado" : "🗓️ Disponível",
    status: enrollmentBySessionId.get(item.id) === "AGENDADO" ? "AGENDADO" : item.status
  }));

  return (
    <AppShell
      title="Agenda de reforços"
      subtitle="Escolha e agende suas sessões"
      role="ALUNO"
    >
      <div className="space-y-6">
        <RulesBanner variant="compact" collapsible />
        <div className="grid gap-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-emerald-900">Comprar aulas</h2>
                <p className="text-sm text-emerald-700">Garanta créditos antes de agendar.</p>
              </div>
              <Link
                href="/aluno/pagamentos"
                className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Ver pacotes
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-700">
              {balances.length === 0 ? (
                <span className="rounded-full border border-emerald-200 bg-white px-3 py-1">Sem créditos ativos.</span>
              ) : (
                balances.map((item) => (
                  <span
                    key={item.subject.id}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-1"
                  >
                    {item.subject.name}: {item.balance}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Como agendar e pagar</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              <li>1. Acesse Pagamentos e escolha um pacote.</li>
              <li>2. Pague via PIX e aguarde a confirmacao.</li>
              <li>3. Se o pacote for sem disciplina, defina a disciplina em Pagamentos.</li>
              <li>4. Volte aqui e agende suas sessões na agenda.</li>
            </ol>
          </div>
          <MonthlyCalendarClient month={month} year={year} items={calendarItems} />
        </div>
        <AgendaClient sessions={sessions} enrollments={enrollments} />
      </div>
    </AppShell>
  );
}
