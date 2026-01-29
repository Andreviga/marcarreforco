"use client";

import { formatCurrency } from "@/lib/format";

interface InvoiceDetail {
  id: string;
  month: number;
  year: number;
  status: string;
  totalCents: number;
  student: { name: string; email: string };
  items: Array<{
    id: string;
    description: string;
    occurredAt: Date;
    amountCents: number;
    attendance: { status: string };
    session: { subject: { name: string }; teacher: { name: string } };
  }>;
}

export default function InvoiceDetailClient({ invoice }: { invoice: InvoiceDetail }) {
  async function updateStatus(status: string) {
    await fetch("/api/admin/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invoice.id, status })
    });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">Aluno</p>
            <p className="text-lg font-semibold text-slate-900">{invoice.student.name}</p>
            <p className="text-xs text-slate-500">{invoice.student.email}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-semibold text-slate-900">{formatCurrency(invoice.totalCents)}</p>
            <p className="text-xs text-slate-500">Status: {invoice.status}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
            href={`/api/invoices/${invoice.id}/export.csv`}
          >
            Exportar CSV
          </a>
          <a
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
            href={`/api/invoices/${invoice.id}/export.pdf`}
          >
            Exportar PDF
          </a>
          <button
            onClick={() => updateStatus("EMITIDA")}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
          >
            Marcar como emitida
          </button>
          <button
            onClick={() => updateStatus("PAGA")}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
          >
            Marcar como paga
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Itens</h2>
        <div className="mt-3 grid gap-2 text-sm">
          {invoice.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 p-3">
              <p className="font-semibold text-slate-900">{item.description}</p>
              <p className="text-xs text-slate-500">
                {new Date(item.occurredAt).toLocaleDateString("pt-BR")} • {item.attendance.status}
              </p>
              <p className="text-xs text-slate-500">{formatCurrency(item.amountCents)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
