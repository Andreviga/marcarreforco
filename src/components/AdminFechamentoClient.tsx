"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

interface InvoiceRow {
  id: string;
  month: number;
  year: number;
  status: string;
  totalCents: number;
  student: { name: string };
}

interface ReportItem {
  name?: string;
  label?: string;
  total?: number;
  count?: number;
}

interface StudentOption {
  id: string;
  name: string;
}

interface FilterState {
  month: number;
  year: number;
  status: string;
  studentId: string;
  page: number;
  pageSize: number;
  total: number;
}

export default function AdminFechamentoClient({
  invoices,
  reports,
  students,
  filters
}: {
  invoices: InvoiceRow[];
  students: StudentOption[];
  filters: FilterState;
  reports: {
    totalByStudent: ReportItem[];
    totalBySubject: ReportItem[];
    totalByTeacher: ReportItem[];
    totalByMonth: ReportItem[];
    presenceRanking: ReportItem[];
  };
}) {
  const [month, setMonth] = useState(filters.month);
  const [year, setYear] = useState(filters.year);
  const [statusFilter, setStatusFilter] = useState(filters.status);
  const [studentId, setStudentId] = useState(filters.studentId);
  const [exportCount, setExportCount] = useState<number | null>(filters.total ?? null);
  const [exportLoading, setExportLoading] = useState(false);

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams({
      month: String(month),
      year: String(year)
    });
    if (statusFilter !== "TODAS") {
      params.set("status", statusFilter);
    }
    if (studentId) {
      params.set("studentId", studentId);
    }
    return params.toString();
  }, [month, year, statusFilter, studentId]);

  useEffect(() => {
    let active = true;

    async function loadCount() {
      setExportLoading(true);
      try {
        const response = await fetch(`/api/admin/invoices?${exportQuery}&countOnly=true`);
        if (!response.ok) {
          throw new Error("Falha ao buscar faturas");
        }
        const data = await response.json();
        if (active) {
          setExportCount(typeof data?.count === "number" ? data.count : 0);
        }
      } catch (error) {
        if (active) {
          setExportCount(null);
        }
      } finally {
        if (active) {
          setExportLoading(false);
        }
      }
    }

    loadCount();

    return () => {
      active = false;
    };
  }, [exportQuery]);

  async function handleGenerate() {
    await fetch("/api/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year })
    });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Gerar faturas</h2>
        <form action="/admin/fechamento" method="GET" className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm text-slate-600">
            Mês
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              name="month"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            />
          </label>
          <label className="text-sm text-slate-600">
            Ano
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              name="year"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </label>
          <label className="text-sm text-slate-600">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={statusFilter}
              name="status"
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="TODAS">Todas</option>
              <option value="ABERTA">Aberta</option>
              <option value="EMITIDA">Emitida</option>
              <option value="PAGA">Paga</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Aluno
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={studentId}
              name="studentId"
              onChange={(event) => setStudentId(event.target.value)}
            >
              <option value="">Todos</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            Gerar
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {exportCount === 0 ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
              Sem faturas para exportar
            </span>
          ) : (
            <>
              <a
                className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
                href={`/api/invoices/export-month.csv?${exportQuery}`}
              >
                Exportar CSV (mes)
              </a>
              <a
                className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
                href={`/api/invoices/export-month.pdf?${exportQuery}`}
              >
                Exportar PDF (mes)
              </a>
            </>
          )}
          <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">
            {exportLoading
              ? "Calculando..."
              : exportCount === null
                ? "Falha ao contar"
                : `Total: ${exportCount}`}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Faturas</h2>
        <div className="mt-3 grid gap-2">
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={`/admin/faturas/${invoice.id}`} className="rounded-lg border border-slate-100 p-3 text-sm hover:bg-slate-50">
              <p className="font-semibold text-slate-900">{invoice.student.name}</p>
              <p className="text-xs text-slate-500">
                {invoice.month}/{invoice.year} • {invoice.status} • {formatCurrency(invoice.totalCents)}
              </p>
            </Link>
          ))}
        </div>
        {filters.total > filters.pageSize && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Pagina {filters.page} de {Math.max(1, Math.ceil(filters.total / filters.pageSize))}
            </span>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: Math.max(1, Math.ceil(filters.total / filters.pageSize)) }).map((_, index) => {
                const pageNumber = index + 1;
                const params = new URLSearchParams({
                  month: String(month),
                  year: String(year),
                  status: statusFilter,
                  studentId: studentId,
                  page: String(pageNumber)
                });
                return (
                  <Link
                    key={pageNumber}
                    href={`/admin/fechamento?${params.toString()}`}
                    className={`rounded-full px-3 py-1 ${
                      pageNumber === filters.page
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {pageNumber}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Total por aluno</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {reports.totalByStudent.map((item) => (
              <li key={item.name} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                <span>{item.name}</span>
                <span className="font-semibold">{formatCurrency(item.total ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Total por disciplina</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {reports.totalBySubject.map((item) => (
              <li key={item.name} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                <span>{item.name}</span>
                <span className="font-semibold">{formatCurrency(item.total ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Total por professor</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {reports.totalByTeacher.map((item) => (
              <li key={item.name} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                <span>{item.name}</span>
                <span className="font-semibold">{formatCurrency(item.total ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Total por mês</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {reports.totalByMonth.map((item) => (
              <li key={item.label} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                <span>{item.label}</span>
                <span className="font-semibold">{formatCurrency(item.total ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Ranking de presenças</h2>
          <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {reports.presenceRanking.map((item) => (
              <li key={item.name} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                <span>{item.name}</span>
                <span className="font-semibold">{item.count ?? 0} presenças</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
