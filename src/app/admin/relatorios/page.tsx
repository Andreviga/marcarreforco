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

  const [
    totalSessoes,
    sessoesAtivas,
    sessoesCanceladas,
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
    ultimosPagamentos
  ] = await Promise.all([
    prisma.session.count(),
    prisma.session.count({ where: { status: "ATIVA" } }),
    prisma.session.count({ where: { status: "CANCELADA" } }),
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
      _count: { _all: true },
      orderBy: { _count: { _all: "desc" } },
      take: 5
    }),
    prisma.asaasPayment.findMany({
      where: { status: "CONFIRMED" },
      include: { user: true, package: true },
      orderBy: { paidAt: "desc" },
      take: 10
    })
  ]);

  const topAusenciasComNome =
    topAusencias.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: topAusencias.map((item) => item.studentId) } },
          select: { id: true, name: true }
        });

  const nomePorAluno = new Map(topAusenciasComNome.map((user) => [user.id, user.name]));

  return (
    <AppShell title="Relatórios" subtitle="Visão consolidada de frequência, agenda e financeiro" role="ADMIN">
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Sessões</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalSessoes}</p>
            <p className="mt-1 text-xs text-slate-500">Ativas: {sessoesAtivas} • Canceladas: {sessoesCanceladas}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Inscrições</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalInscricoes}</p>
            <p className="mt-1 text-xs text-slate-500">Agendadas: {inscricoesAgendadas} • Desmarcadas: {inscricoesDesmarcadas}</p>
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
                    <p className="text-xs text-slate-500">{item._count._all} ausência(s)</p>
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
      </div>
    </AppShell>
  );
}
