import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@prisma/client";
import { requireApiRole } from "@/lib/api-auth";
import { formatCurrency } from "@/lib/format";

export async function GET(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN", "ALUNO"]);
  if (response) return response;

  const url = new URL(request.url);
  const month = Number(url.searchParams.get("month"));
  const year = Number(url.searchParams.get("year"));
  const status = url.searchParams.get("status");
  const studentIdParam = url.searchParams.get("studentId");
  const allowedStatuses = new Set<InvoiceStatus>(["ABERTA", "EMITIDA", "PAGA"]);

  if (!month || month < 1 || month > 12 || !year) {
    return NextResponse.json({ message: "Mes ou ano invalido" }, { status: 400 });
  }

  let studentId: string | null = null;
  if (session?.user.role === "ALUNO") {
    studentId = session.user.id;
  } else {
    studentId = studentIdParam;
  }

  if (!studentId && session?.user.role === "ALUNO") {
    return NextResponse.json({ message: "studentId obrigatorio" }, { status: 400 });
  }

  const statusFilter =
    status && allowedStatuses.has(status as InvoiceStatus) ? (status as InvoiceStatus) : undefined;

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      month,
      year,
      ...(statusFilter ? { status: statusFilter } : {})
    },
    include: { student: true },
    orderBy: { createdAt: "desc" }
  });

  const header = ["Fatura ID", "Aluno ID", "Aluno", "Competencia", "Status", "Total"];
  const rows = invoices.map((invoice) => [
    invoice.id,
    invoice.studentId,
    invoice.student.name,
    `${invoice.month}/${invoice.year}`,
    invoice.status,
    formatCurrency(invoice.totalCents)
  ]);

  const generatedAt = new Date().toLocaleString("pt-BR");
  const studentName = studentId ? invoices[0]?.student?.name ?? "Aluno selecionado" : "Todos";
  const statusLabel = statusFilter ?? "TODAS";
  const reportHeader = `# Relatorio de faturas ${month}/${year} - aluno ${studentName} - status ${statusLabel} - total ${invoices.length} - gerado em ${generatedAt}`;
  const dataLines = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","));
  const csv = [reportHeader, ...dataLines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=invoices-${year}-${String(month).padStart(2, "0")}.csv`
    }
  });
}
