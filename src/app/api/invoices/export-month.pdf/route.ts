import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
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
  const allowedStatuses = new Set(["ABERTA", "EMITIDA", "PAGA"]);

  if (!month || month < 1 || month > 12 || !year) {
    return new Response("Mes ou ano invalido", { status: 400 });
  }

  let studentId: string | null = null;
  if (session?.user.role === "ALUNO") {
    studentId = session.user.id;
  } else {
    studentId = studentIdParam;
  }

  if (!studentId && session?.user.role === "ALUNO") {
    return new Response("studentId obrigatorio", { status: 400 });
  }

  const statusFilter = status && allowedStatuses.has(status) ? status : undefined;

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      month,
      year,
      ...(statusFilter ? { status: statusFilter } : {})
    },
    include: {
      student: true,
      items: {
        include: {
          session: { include: { subject: true, teacher: true } },
          attendance: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const totalCents = invoices.reduce((acc, item) => acc + item.totalCents, 0);

  const doc = new PDFDocument({ margin: 40, bufferPages: true });
  const chunks: Uint8Array[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  const studentLabel = studentId ? invoices[0]?.student?.name ?? "Aluno selecionado" : "Todos";
  const statusLabel = statusFilter ?? "TODAS";
  const multiStudent = !studentId;

  function renderHeader() {
    doc.fontSize(18).text("Resumo de faturas", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Competencia: ${month}/${year}`);
    doc.text(`Aluno: ${studentLabel}`);
    doc.text(`Status: ${statusLabel}`);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
    doc.moveDown();
  }

  function ensureSpace(extra = 16, beforeBreak?: () => void, showContinuation = true) {
    if (doc.y + extra > doc.page.height - doc.page.margins.bottom) {
      if (beforeBreak) {
        beforeBreak();
      }
      if (showContinuation) {
        doc.fontSize(9).text("Continua na proxima pagina...");
      }
      doc.addPage();
      renderHeader();
    }
  }

  renderHeader();

  if (invoices.length === 0) {
    doc.fontSize(11).text("Nenhuma fatura encontrada.");
  } else {
    doc.fontSize(11).text("Faturas detalhadas:");
    doc.moveDown(0.5);

    invoices.forEach((invoice, index) => {
      if (index > 0) {
        ensureSpace(24);
        doc.moveDown();
      }
      doc
        .fontSize(12)
        .text(
          `Fatura ${invoice.month}/${invoice.year} - ${invoice.status}${multiStudent ? ` - ${invoice.student.name}` : ""}`,
          { underline: true }
        );
      doc
        .fontSize(10)
        .text(`Total: ${formatCurrency(invoice.totalCents)}`);
      doc.moveDown(0.25);

      if (invoice.items.length === 0) {
        ensureSpace(14);
        doc.fontSize(10).text("Sem itens nesta fatura.");
        return;
      }

      let runningTotal = 0;
      invoice.items.forEach((item) => {
        runningTotal += item.amountCents;
        ensureSpace(14, () => {
          doc
            .fontSize(9)
            .text(`Subtotal parcial da fatura: ${formatCurrency(runningTotal)}`);
          doc.moveDown(0.25);
        }, true);
        doc
          .fontSize(9)
          .text(
            `${new Date(item.occurredAt).toLocaleDateString("pt-BR")} - ${item.session.subject.name} - ${item.session.teacher.name} - ${item.attendance.status} - ${formatCurrency(item.amountCents)}`
          );
      });

      ensureSpace(16, undefined, false);
      doc
        .fontSize(10)
        .text(`Subtotal da fatura: ${formatCurrency(runningTotal)}`);
    });

    ensureSpace(20);
    doc.moveDown();
    doc.fontSize(12).text(`Total do mes: ${formatCurrency(totalCents)}`);
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const footerY = doc.page.height - doc.page.margins.bottom + 10;
    doc.fontSize(9).text(`Aluno: ${studentLabel}`, 0, footerY, { align: "left" });
    doc.fontSize(9).text(
      `Pagina ${i + 1} de ${range.count}`,
      0,
      footerY,
      { align: "right" }
    );
  }
  doc.end();

  const buffer = Buffer.concat(chunks);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=invoices-${year}-${String(month).padStart(2, "0")}.pdf`
    }
  });
}
