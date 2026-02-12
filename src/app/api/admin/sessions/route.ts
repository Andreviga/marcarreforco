import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { sessionCreateSchema, sessionUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const sessions = await prisma.session.findMany({
    orderBy: { startsAt: "asc" },
    include: { subject: true, teacher: true }
  });
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = sessionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const created = await prisma.session.create({
    data: {
      subjectId: parsed.data.subjectId,
      teacherId: parsed.data.teacherId,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      location: parsed.data.location,
      modality: parsed.data.modality,
      priceCents: parsed.data.priceCents,
      status: parsed.data.status ?? "ATIVA"
    }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "CREATE_SESSION",
    entityType: "Session",
    entityId: created.id,
    payload: parsed.data
  });

  return NextResponse.json({ session: created });
}

export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = sessionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const updated = await prisma.session.update({
    where: { id: parsed.data.id },
    data: {
      subjectId: parsed.data.subjectId,
      teacherId: parsed.data.teacherId,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      location: parsed.data.location,
      modality: parsed.data.modality,
      priceCents: parsed.data.priceCents,
      status: parsed.data.status
    }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "UPDATE_SESSION",
    entityType: "Session",
    entityId: updated.id,
    payload: parsed.data
  });

  return NextResponse.json({ session: updated });
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
    await prisma.session.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "Nao foi possivel excluir: a sessao possui matriculas vinculadas." },
        { status: 409 }
      );
    }
    throw error;
  }
  await logAudit({
    actorUserId: session.user.id,
    action: "DELETE_SESSION",
    entityType: "Session",
    entityId: id,
    payload: { id }
  });

  return NextResponse.json({ ok: true });
}
