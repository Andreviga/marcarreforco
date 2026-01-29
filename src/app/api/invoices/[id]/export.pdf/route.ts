import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { formatCurrency } from "@/lib/format";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { student: true, items: { include: { session: { include: { subject: true, teacher: true } }, attendance: true } } }
  });

  if (!invoice) {
    return new Response("Fatura não encontrada", { status: 404 });
  }

  const doc = new PDFDocument({ margin: 40 });
  const chunks: Uint8Array[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(18).text("Fatura de Reforço", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Aluno: ${invoice.student.name}`);
  doc.text(`Competência: ${invoice.month}/${invoice.year}`);
  doc.text(`Status: ${invoice.status}`);
  doc.moveDown();

  doc.fontSize(11).text("Itens:");
  doc.moveDown(0.5);

  invoice.items.forEach((item) => {
    doc
      .fontSize(10)
      .text(
        `${new Date(item.occurredAt).toLocaleDateString("pt-BR")} - ${item.session.subject.name} - ${item.session.teacher.name} - ${item.attendance.status} - ${formatCurrency(item.amountCents)}`
      );
  });

  doc.moveDown();
  doc.fontSize(12).text(`Total: ${formatCurrency(invoice.totalCents)}`);
  doc.end();

  const buffer = Buffer.concat(chunks);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=invoice-${invoice.id}.pdf`
    }
  });
}
