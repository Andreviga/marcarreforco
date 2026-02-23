import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { subjectSchema, subjectUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    include: { teachers: { include: { teacher: { include: { user: true } } } } }
  });
  return NextResponse.json({ subjects });
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = subjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const created = await prisma.subject.create({
    data: { name: parsed.data.name, defaultPriceCents: parsed.data.defaultPriceCents ?? 0 }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "CREATE_SUBJECT",
    entityType: "Subject",
    entityId: created.id,
    payload: parsed.data
  });

  return NextResponse.json({ subject: created });
}

export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = subjectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const updated = await prisma.subject.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, defaultPriceCents: parsed.data.defaultPriceCents ?? 0 }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "UPDATE_SUBJECT",
    entityType: "Subject",
    entityId: updated.id,
    payload: parsed.data
  });

  return NextResponse.json({ subject: updated });
}

export async function DELETE(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "ID obrigatório" }, { status: 400 });
  }

  try {
    await prisma.subject.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "Não foi possível excluir: a disciplina possui vínculos (professores ou sessões)." },
        { status: 409 }
      );
    }
    throw error;
  }
  await logAudit({
    actorUserId: session.user.id,
    action: "DELETE_SUBJECT",
    entityType: "Subject",
    entityId: id,
    payload: { id }
  });

  return NextResponse.json({ ok: true });
}
