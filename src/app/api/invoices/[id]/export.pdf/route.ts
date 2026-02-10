import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { formatCurrency } from "@/lib/format";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { session, response } = await requireApiRole(["ADMIN", "ALUNO"]);
  if (response) return response;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { student: true, items: { include: { session: { include: { subject: true, teacher: true } }, attendance: true } } }
  });

  if (!invoice) {
    return new Response("Fatura não encontrada", { status: 404 });
  }

  if (session?.user.role === "ALUNO" && invoice.studentId !== session.user.id) {
    return new Response("Sem permissão", { status: 403 });
  }

  const invoiceData = invoice;
  const doc = new PDFDocument({ margin: 40, bufferPages: true });
  const chunks: Uint8Array[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  function renderHeader() {
    doc.fontSize(18).text("Fatura de Reforço", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Aluno: ${invoiceData.student.name}`);
    doc.text(`Competência: ${invoiceData.month}/${invoiceData.year}`);
    doc.text(`Status: ${invoiceData.status}`);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
    doc.moveDown();
  }

  function ensureSpace(extra = 16) {
    if (doc.y + extra > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      renderHeader();
    }
  }

  renderHeader();

  doc.fontSize(11).text("Itens:");
  doc.moveDown(0.5);

  invoiceData.items.forEach((item) => {
    ensureSpace(14);
    doc
      .fontSize(10)
      .text(
        `${new Date(item.occurredAt).toLocaleDateString("pt-BR")} - ${item.session.subject.name} - ${item.session.teacher.name} - ${item.attendance.status} - ${formatCurrency(item.amountCents)}`
      );
  });

  doc.moveDown();
  doc.fontSize(12).text(`Total: ${formatCurrency(invoiceData.totalCents)}`);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const footerY = doc.page.height - doc.page.margins.bottom + 10;
    doc.fontSize(9).text(`Fatura ${invoiceData.month}/${invoiceData.year} - ${invoiceData.student.name}`, 0, footerY, { align: "left" });
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
      "Content-Disposition": `attachment; filename=invoice-${invoiceData.id}.pdf`
    }
  });
}
