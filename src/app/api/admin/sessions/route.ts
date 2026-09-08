import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { sessionCreateSchema, sessionUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { releaseCredit } from "@/lib/credits";

// Desmarca todas as inscrições ativas devolvendo os créditos reservados —
// usado ao cancelar ou excluir uma sessão, para o crédito não ficar preso.
async function refundActiveEnrollments(sessionId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { sessionId, status: "AGENDADO" },
    include: { attendance: { select: { status: true } } }
  });

  for (const enrollmentRecord of enrollments) {
    await prisma.$transaction(async (tx) => {
      // "Reivindica" a inscrição dentro da transação: se o aluno desmarcou
      // (e já recebeu o crédito) entre a leitura e este ponto, count = 0 e
      // nada é devolvido de novo.
      const claimed = await tx.enrollment.updateMany({
        where: { id: enrollmentRecord.id, status: "AGENDADO" },
        data: { status: "DESMARCADO", creditsReserved: 0 }
      });
      if (claimed.count === 0) {
        return;
      }
      // Aula já assistida (presença marcada) foi consumida — sem devolução.
      const attended = enrollmentRecord.attendance?.status === "PRESENTE";
      if (enrollmentRecord.creditsReserved > 0 && !attended) {
        await releaseCredit({
          tx,
          studentId: enrollmentRecord.studentId,
          enrollmentId: enrollmentRecord.id
        });
      }
    });
  }

  return enrollments.length;
}

export async function GET() {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const sessions = await prisma.session.findMany({
    orderBy: { startsAt: "asc" },
    include: { subject: true, teacher: { select: { id: true, name: true, email: true } } }
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

  if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
    return NextResponse.json({ message: "O horário de término deve ser depois do início." }, { status: 400 });
  }

  const created = await prisma.session.create({
    data: {
      subjectId: parsed.data.subjectId,
      teacherId: parsed.data.teacherId,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      location: parsed.data.location,
      modality: parsed.data.modality,
      priceCents: parsed.data.priceCents ?? 0,
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

  const before = await prisma.session.findUnique({
    where: { id: parsed.data.id },
    select: { status: true, startsAt: true, endsAt: true }
  });

  if (before) {
    const finalStartsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : before.startsAt;
    const finalEndsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : before.endsAt;
    if (finalEndsAt <= finalStartsAt) {
      return NextResponse.json({ message: "O horário de término deve ser depois do início." }, { status: 400 });
    }
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

  // Cancelar a sessão devolve os créditos dos alunos inscritos — antes eles
  // ficavam presos (o unenroll do aluno recusa sessão cancelada).
  if (parsed.data.status === "CANCELADA" && before?.status !== "CANCELADA") {
    await refundActiveEnrollments(updated.id);
  }

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

  // Devolver os créditos antes de excluir — senão as inscrições seriam
  // apagadas com o crédito do aluno preso para sempre.
  await refundActiveEnrollments(id);

  try {
    await prisma.$transaction([
      prisma.enrollment.deleteMany({ where: { sessionId: id } }),
      prisma.session.delete({ where: { id } })
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      // Há histórico financeiro (ledger/presença) vinculado: em vez de perder
      // dados, cancela a sessão — os créditos já foram devolvidos acima.
      await prisma.session.update({ where: { id }, data: { status: "CANCELADA" } });
      await logAudit({
        actorUserId: session.user.id,
        action: "CANCEL_SESSION_INSTEAD_OF_DELETE",
        entityType: "Session",
        entityId: id,
        payload: { id }
      });
      return NextResponse.json({
        ok: true,
        canceled: true,
        message: "A sessão possui histórico vinculado e foi cancelada (créditos devolvidos) em vez de excluída."
      });
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
