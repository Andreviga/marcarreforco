import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import { formatCurrency } from "@/lib/format";

function pct(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function AdminRelatoriosPage() {
  await requireRole(["ADMIN"]);

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalSessoes,
    sessoesAtivas,
    sessoesCanceladas,
    sessoesProximos7Dias,
    sessoesUltimos30Dias,
    sessoesComInscricoes,
    totalInscricoes,
    inscricoesAgendadas,
    inscricoesDesmarcadas,
    presencas,
    ausencias,
    atrasos,
    pagamentosConfirmados,
    pagamentosPendentes,
    pagamentosAtrasados,
    assinaturasAtivas,
    topAusencias,
    ultimosPagamentos,
    topDisciplinas,
    topProfessores,
    pagamentosPorStatus,
    ultimasSessoes
  ] = await Promise.all([
    prisma.session.count(),
    prisma.session.count({ where: { status: "ATIVA" } }),
    prisma.session.count({ where: { status: "CANCELADA" } }),
    prisma.session.count({
      where: {
        status: "ATIVA",
        startsAt: { gte: now, lte: in7Days }
      }
    }),
    prisma.session.count({ where: { startsAt: { gte: last30Days } } }),
    prisma.session.count({ where: { enrollments: { some: {} } } }),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { status: "AGENDADO" } }),
    prisma.enrollment.count({ where: { status: "DESMARCADO" } }),
    prisma.attendance.count({ where: { status: "PRESENTE" } }),
    prisma.attendance.count({ where: { status: "AUSENTE" } }),
    prisma.attendance.count({ where: { status: "ATRASADO" } }),
    prisma.asaasPayment.aggregate({
      where: { status: "CONFIRMED" },
      _sum: { amountCents: true },
      _count: { _all: true }
    }),
    prisma.asaasPayment.count({ where: { status: "PENDING" } }),
    prisma.asaasPayment.count({ where: { status: "OVERDUE" } }),
    prisma.asaasSubscription.count({ where: { status: "ACTIVE" } }),
    prisma.attendance.groupBy({
      by: ["studentId"],
      where: { status: "AUSENTE" },
      _count: { studentId: true },
      orderBy: { _count: { studentId: "desc" } },
      take: 5
    }),
    prisma.asaasPayment.findMany({
      where: { status: "CONFIRMED" },
      include: { user: true, package: true },
      orderBy: { paidAt: "desc" },
      take: 10
    }),
    prisma.session.groupBy({
      by: ["subjectId"],
      _count: { _all: true },
      orderBy: { _count: { subjectId: "desc" } },
      take: 5
    }),
    prisma.session.groupBy({
      by: ["teacherId"],
      _count: { _all: true },
      orderBy: { _count: { teacherId: "desc" } },
      take: 5
    }),
    prisma.asaasPayment.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amountCents: true },
      orderBy: { _count: { status: "desc" } }
    }),
    prisma.session.findMany({
      include: {
        subject: { select: { name: true } },
        teacher: { select: { name: true } },
        _count: {
          select: {
            enrollments: true,
            attendances: true
          }
        }
      },
      orderBy: { startsAt: "desc" },
      take: 12
    })
  ]);

  const [topAusenciasComNome, subjectNames, teacherNames] = await Promise.all([
    topAusencias.length === 0
      ? []
      : prisma.user.findMany({
          where: { id: { in: topAusencias.map((item) => item.studentId) } },
          select: { id: true, name: true }
        }),
    topDisciplinas.length === 0
      ? []
      : prisma.subject.findMany({
          where: { id: { in: topDisciplinas.map((item) => item.subjectId) } },
          select: { id: true, name: true }
        }),
    topProfessores.length === 0
      ? []
      : prisma.user.findMany({
          where: { id: { in: topProfessores.map((item) => item.teacherId) } },
          select: { id: true, name: true }
        })
  ]);

  const nomePorAluno = new Map(topAusenciasComNome.map((user) => [user.id, user.name]));
  const nomePorDisciplina = new Map(subjectNames.map((subject) => [subject.id, subject.name]));
  const nomePorProfessor = new Map(teacherNames.map((teacher) => [teacher.id, teacher.name]));

  return (
    <AppShell title="Relatórios" subtitle="Visão consolidada de frequência, agenda e financeiro" role="ADMIN">
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Sessões</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalSessoes}</p>
            <p className="mt-1 text-xs text-slate-500">Ativas: {sessoesAtivas} • Canceladas: {sessoesCanceladas}</p>
            <p className="text-xs text-slate-500">Próx. 7 dias: {sessoesProximos7Dias}</p>
            <p className="text-xs text-slate-500">Últimos 30 dias: {sessoesUltimos30Dias}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Inscrições</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalInscricoes}</p>
            <p className="mt-1 text-xs text-slate-500">Agendadas: {inscricoesAgendadas} • Desmarcadas: {inscricoesDesmarcadas}</p>
            <p className="text-xs text-slate-500">Sessões com inscritos: {sessoesComInscricoes}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Frequência</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{presencas}</p>
            <p className="mt-1 text-xs text-slate-500">Presença: {pct(presencas, presencas + ausencias + atrasos)}</p>
            <p className="text-xs text-slate-500">Ausências: {ausencias} • Atrasos: {atrasos}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Recebido (Asaas confirmado)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(pagamentosConfirmados._sum.amountCents ?? 0)}</p>
            <p className="mt-1 text-xs text-slate-500">Pagamentos: {pagamentosConfirmados._count._all} • Assinaturas ativas: {assinaturasAtivas}</p>
            <p className="text-xs text-slate-500">Pendentes: {pagamentosPendentes} • Em atraso: {pagamentosAtrasados}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Top 5 ausências por aluno</h2>
            <p className="text-xs text-slate-500">Baseado em registros de chamada com status AUSENTE.</p>
            <div className="mt-3 space-y-2 text-sm">
              {topAusencias.length === 0 ? (
                <p className="text-slate-500">Sem ausências registradas.</p>
              ) : (
                topAusencias.map((item) => (
                  <div key={item.studentId} className="rounded-lg border border-slate-100 p-3">
                    <p className="font-medium text-slate-900">{nomePorAluno.get(item.studentId) ?? item.studentId}</p>
                    <p className="text-xs text-slate-500">{item._count.studentId} ausência(s)</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Últimos recebimentos</h2>
            <p className="text-xs text-slate-500">Somente pagamentos confirmados pelo Asaas.</p>
            <div className="mt-3 space-y-2 text-sm">
              {ultimosPagamentos.length === 0 ? (
                <p className="text-slate-500">Nenhum recebimento confirmado.</p>
              ) : (
                ultimosPagamentos.map((payment) => (
                  <div key={payment.id} className="rounded-lg border border-slate-100 p-3">
                    <p className="font-medium text-slate-900">{payment.user.name}</p>
                    <p className="text-xs text-slate-500">{payment.package.name}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(payment.amountCents)}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Disciplinas com mais sessões</h2>
            <div className="mt-3 space-y-2 text-sm">
              {topDisciplinas.length === 0 ? (
                <p className="text-slate-500">Sem dados suficientes.</p>
              ) : (
                topDisciplinas.map((item) => (
                  <div key={item.subjectId} className="rounded-lg border border-slate-100 p-3">
                    <p className="font-medium text-slate-900">{nomePorDisciplina.get(item.subjectId) ?? item.subjectId}</p>
                    <p className="text-xs text-slate-500">{item._count._all} sessão(ões)</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Professores com mais sessões</h2>
            <div className="mt-3 space-y-2 text-sm">
              {topProfessores.length === 0 ? (
                <p className="text-slate-500">Sem dados suficientes.</p>
              ) : (
                topProfessores.map((item) => (
                  <div key={item.teacherId} className="rounded-lg border border-slate-100 p-3">
                    <p className="font-medium text-slate-900">{nomePorProfessor.get(item.teacherId) ?? item.teacherId}</p>
                    <p className="text-xs text-slate-500">{item._count._all} sessão(ões)</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Pagamentos por status</h2>
            <div className="mt-3 space-y-2 text-sm">
              {pagamentosPorStatus.length === 0 ? (
                <p className="text-slate-500">Sem dados de pagamentos.</p>
              ) : (
                pagamentosPorStatus.map((item) => (
                  <div key={item.status} className="rounded-lg border border-slate-100 p-3">
                    <p className="font-medium text-slate-900">{item.status}</p>
                    <p className="text-xs text-slate-500">
                      {item._count._all} pagamento(s) • {formatCurrency(item._sum.amountCents ?? 0)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Últimas sessões (detalhado)</h2>
          <p className="text-xs text-slate-500">Resumo com disciplina, professor, status e volume de alunos/chamadas.</p>
          <div className="mt-3 space-y-2 text-sm">
            {ultimasSessoes.length === 0 ? (
              <p className="text-slate-500">Nenhuma sessão encontrada.</p>
            ) : (
              ultimasSessoes.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="font-medium text-slate-900">{item.subject.name}</p>
                  <p className="text-xs text-slate-500">Professor: {item.teacher.name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(item.startsAt).toLocaleDateString("pt-BR")} {new Date(item.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {" "}• {new Date(item.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-slate-500">Status: {item.status}</p>
                  <p className="text-xs text-slate-500">Inscrições: {item._count.enrollments} • Chamadas: {item._count.attendances}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
