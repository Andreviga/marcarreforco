import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { unenrollSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { releaseCredit } from "@/lib/credits";

const CANCEL_WINDOW_HOURS = 48;

function canCancelUntil(startsAt: Date) {
  const diffMs = startsAt.getTime() - Date.now();
  return diffMs >= CANCEL_WINDOW_HOURS * 60 * 60 * 1000;
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO"]);
  if (response) return response;

  const body = await request.json();
  const parsed = unenrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    include: { session: true }
  });

  if (!enrollment || enrollment.studentId !== session.user.id) {
    return NextResponse.json({ message: "Inscrição não encontrada" }, { status: 404 });
  }

  if (enrollment.session.status === "CANCELADA") {
    return NextResponse.json({ message: "Sessão cancelada" }, { status: 400 });
  }

  if (!canCancelUntil(enrollment.session.startsAt)) {
    return NextResponse.json(
      { message: "Desmarcação permitida apenas até 48 horas antes da aula." },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "DESMARCADO" }
    });

    const shouldRefund =
      record.creditsReserved > 0 && enrollment.session.startsAt > new Date() && enrollment.session.subjectId;

    if (shouldRefund) {
      await releaseCredit({
        tx,
        studentId: enrollment.studentId,
        subjectId: enrollment.session.subjectId,
        enrollmentId: enrollment.id
      });
    }

    if (record.creditsReserved > 0) {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { creditsReserved: 0 }
      });
    }

    return record;
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "UNENROLL",
    entityType: "Enrollment",
    entityId: updated.id,
    payload: { sessionId: updated.sessionId }
  });

  return NextResponse.json({ enrollment: updated });
}
