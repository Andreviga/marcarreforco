import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { ticketCreateSchema } from "@/lib/validators";

export async function GET() {
  const { session, response } = await requireApiRole(["ALUNO", "PROFESSOR", "ADMIN"]);
  if (response) return response;

  const role = session.user.role;
  const userId = session.user.id;

  const where =
    role === "ADMIN"
      ? {}
      : role === "PROFESSOR"
        ? { teacherId: userId }
        : { studentId: userId };

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      student: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { messages: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO", "PROFESSOR", "ADMIN"]);
  if (response) return response;

  const body = await request.json();
  // O formulário envia campos não usados como "" — tratar como ausentes
  // (o schema rejeita string vazia, o que quebrava a criação de tickets).
  if (body && typeof body === "object") {
    if (body.studentId === "") delete body.studentId;
    if (body.teacherId === "") delete body.teacherId;
  }
  const parsed = ticketCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const role = session.user.role;
  const userId = session.user.id;

  // Aluno é sempre o aluno do próprio ticket e professor é sempre o professor
  // do próprio ticket — o body não pode atribuir o ticket a terceiros.
  const studentId = role === "ALUNO" ? userId : parsed.data.studentId;
  const teacherId = role === "PROFESSOR" ? userId : parsed.data.teacherId;

  if (role === "ALUNO") {
    if (!teacherId) {
      return NextResponse.json({ message: "Professor obrigatório" }, { status: 400 });
    }
    if (parsed.data.category !== "DUVIDA") {
      return NextResponse.json({ message: "Categoria inválida" }, { status: 400 });
    }
  }

  if (role === "PROFESSOR") {
    if (!studentId) {
      return NextResponse.json({ message: "Aluno obrigatório" }, { status: 400 });
    }
    if (parsed.data.category !== "MELHORIA") {
      return NextResponse.json({ message: "Categoria inválida" }, { status: 400 });
    }
  }

  if (role === "ADMIN" && (!studentId || !teacherId)) {
    return NextResponse.json({ message: "Aluno e professor são obrigatórios" }, { status: 400 });
  }

  const created = await prisma.ticket.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      studentId: studentId ?? userId,
      teacherId: teacherId ?? userId,
      createdById: userId
    }
  });

  return NextResponse.json({ ticket: created });
}
