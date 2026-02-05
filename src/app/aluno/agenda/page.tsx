import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AgendaClient from "@/components/AgendaClient";
import MonthlyCalendarClient from "@/components/MonthlyCalendarClient";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";

const allowedInvoiceStatuses = new Set(["ABERTA", "EMITIDA", "PAGA"]);

export default async function AlunoAgendaPage({
  searchParams
}: {
  searchParams?: { status?: string; exportMonth?: string; exportYear?: string };
} = {}) {
  const session = await requireRole(["ALUNO"]);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const sessions = await prisma.session.findMany({
    where: { status: "ATIVA" },
    include: { subject: true, teacher: true },
    orderBy: { startsAt: "asc" }
  });

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: session.user.id },
    include: { session: true }
  });

  const invoice = await prisma.invoice.findUnique({
    where: {
      studentId_month_year: {
        studentId: session.user.id,
        month,
        year
      }
    }
  });

  const statusFilter =
    typeof searchParams?.status === "string" && allowedInvoiceStatuses.has(searchParams.status)
      ? searchParams.status
      : undefined;

  const exportMonth = Number(searchParams?.exportMonth) || month;
  const exportYear = Number(searchParams?.exportYear) || year;
  const exportMonthValue = exportMonth >= 1 && exportMonth <= 12 ? exportMonth : month;
  const exportYearValue = exportYear > 2000 ? exportYear : year;

  const invoices = await prisma.invoice.findMany({
    where: {
      studentId: session.user.id,
      ...(statusFilter ? { status: statusFilter } : {})
    },
    orderBy: [{ year: "desc" }, { month: "desc" }]
  });

  const exportInvoices = await prisma.invoice.findMany({
    where: {
      studentId: session.user.id,
      month: exportMonthValue,
      year: exportYearValue,
      ...(statusFilter ? { status: statusFilter } : {})
    },
    orderBy: [{ year: "desc" }, { month: "desc" }]
  });
  const exportInvoiceCount = exportInvoices.length;

  const invoiceCounts = await prisma.invoice.groupBy({
    by: ["status"],
    where: { studentId: session.user.id },
    _count: { _all: true }
  });
  const countsByStatus = invoiceCounts.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {});
  const totalCount = invoiceCounts.reduce((acc, item) => acc + item._count._all, 0);
  const statusOptions = ["ABERTA", "EMITIDA", "PAGA"];
  const sortedStatuses = [...statusOptions].sort(
    (a, b) => (countsByStatus[b] ?? 0) - (countsByStatus[a] ?? 0)
  );

  const calendarItems = sessions.map((item) => ({
    id: item.id,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    title: item.subject.name,
    subtitle: `${item.teacher.name} • ${item.modality === "ONLINE" ? "Online" : item.location}`,
    meta: `Valor: ${formatCurrency(item.priceCents)}`,
    status: item.status
  }));

  return (
    <AppShell
      title="Agenda de reforços"
      subtitle="Escolha e agende suas sessões"
      role="ALUNO"
    >
      <div className="space-y-6">
        <div className="grid gap-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Fatura do mes</h2>
            <p className="text-sm text-slate-500">{month}/{year}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCurrency(invoice?.totalCents ?? 0)}
            </p>
            <p className="text-xs text-slate-500">
              Status: {invoice?.status ?? "Nao gerada"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Faturas passadas</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {["TODAS", ...sortedStatuses].map((status) => {
                const isActive =
                  (status === "TODAS" && !statusFilter) || status === statusFilter;
                const href = status === "TODAS" ? "/aluno/agenda" : `/aluno/agenda?status=${status}`;
                const countLabel =
                  status === "TODAS"
                    ? totalCount
                    : countsByStatus[status] ?? 0;
                return (
                  <Link
                    key={status}
                    href={href}
                    className={`rounded-full px-3 py-1 ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {status === "TODAS" ? "Todas" : status} ({countLabel})
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <form className="flex flex-wrap items-end gap-2" method="GET">
                {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
                <label className="text-xs text-slate-600">
                  Mes
                  <input
                    name="exportMonth"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={exportMonthValue}
                    className="mt-1 w-20 rounded-lg border border-slate-200 px-2 py-1"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Ano
                  <input
                    name="exportYear"
                    type="number"
                    min={2020}
                    max={2100}
                    defaultValue={exportYearValue}
                    className="mt-1 w-24 rounded-lg border border-slate-200 px-2 py-1"
                  />
                </label>
                <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">
                  Atualizar
                </button>
              </form>
              {exportInvoiceCount === 0 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                  Sem faturas para exportar neste mes (0)
                </span>
              ) : (
                <>
                  <a
                    className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
                    href={`/api/invoices/export-month.csv?month=${exportMonthValue}&year=${exportYearValue}${statusFilter ? `&status=${statusFilter}` : ""}`}
                  >
                    Exportar CSV ({exportInvoiceCount})
                  </a>
                  <a
                    className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
                    href={`/api/invoices/export-month.pdf?month=${exportMonthValue}&year=${exportYearValue}${statusFilter ? `&status=${statusFilter}` : ""}`}
                  >
                    Exportar PDF ({exportInvoiceCount})
                  </a>
                </>
              )}
            </div>
            {invoices.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nenhuma fatura encontrada.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {invoices.map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                    <div>
                      <p className="font-semibold text-slate-900">{item.month}/{item.year}</p>
                      <p className="text-xs text-slate-500">Status: {item.status}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <a
                          className="rounded-full border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                          href={`/api/invoices/${item.id}/export.csv`}
                        >
                          Exportar CSV
                        </a>
                        <a
                          className="rounded-full border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                          href={`/api/invoices/${item.id}/export.pdf`}
                        >
                          Exportar PDF
                        </a>
                      </div>
                    </div>
                    <span className="font-semibold text-slate-700">{formatCurrency(item.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <MonthlyCalendarClient month={month} year={year} items={calendarItems} />
        </div>
        <AgendaClient sessions={sessions} enrollments={enrollments} />
      </div>
    </AppShell>
  );
}
