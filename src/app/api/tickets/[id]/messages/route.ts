import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { ticketMessageSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: { id: string } }) {
  const { session, response } = await requireApiRole(["ALUNO", "PROFESSOR", "ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = ticketMessageSchema.safeParse({ ...body, ticketId: context.params.id });
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    select: { id: true, studentId: true, teacherId: true }
  });

  if (!ticket) {
    return NextResponse.json({ message: "Ticket não encontrado" }, { status: 404 });
  }

  const role = session.user.role;
  const userId = session.user.id;
  const canAccess = role === "ADMIN" || ticket.studentId === userId || ticket.teacherId === userId;

  if (!canAccess) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const created = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: userId,
      message: parsed.data.message
    }
  });

  return NextResponse.json({ message: created });
}
