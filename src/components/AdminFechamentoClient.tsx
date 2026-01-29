"use client";

import { useState } from "react";
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

export default function AdminFechamentoClient({
  invoices,
  reports
}: {
  invoices: InvoiceRow[];
  reports: {
    totalByStudent: ReportItem[];
    totalBySubject: ReportItem[];
    totalByTeacher: ReportItem[];
    totalByMonth: ReportItem[];
    presenceRanking: ReportItem[];
  };
}) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

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
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm text-slate-600">
            Mês
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            />
          </label>
          <label className="text-sm text-slate-600">
            Ano
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </label>
          <button
            onClick={handleGenerate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            Gerar
          </button>
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
