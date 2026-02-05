import { NextResponse } from "next/server";
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
    return NextResponse.json({ message: "Fatura não encontrada" }, { status: 404 });
  }

  if (session?.user.role === "ALUNO" && invoice.studentId !== session.user.id) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const header = ["Data", "Sessão", "Disciplina", "Professor", "Status", "Valor"];
  const rows = invoice.items.map((item) => [
    new Date(item.occurredAt).toLocaleDateString("pt-BR"),
    item.sessionId,
    item.session.subject.name,
    item.session.teacher.name,
    item.attendance.status,
    formatCurrency(item.amountCents)
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=invoice-${invoice.id}.csv`
    }
  });
}
