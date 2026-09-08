import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { unenrollSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { releaseCredit } from "@/lib/credits";

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

  // Regra anunciada aos alunos (banner e tela de login): cancelamento com
  // menos de 48h de antecedência não devolve o crédito.
  const MIN_REFUND_ADVANCE_MS = 48 * 60 * 60 * 1000;
  const withinRefundWindow =
    enrollment.session.startsAt.getTime() - Date.now() >= MIN_REFUND_ADVANCE_MS;

  let refunded = false;
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "DESMARCADO" }
    });

    const shouldRefund =
      record.creditsReserved > 0 && withinRefundWindow && enrollment.session.subjectId;

    if (shouldRefund) {
      refunded = await releaseCredit({
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

  return NextResponse.json({
    enrollment: updated,
    refunded,
    message: refunded
      ? "Aula desmarcada e crédito devolvido."
      : withinRefundWindow
        ? "Aula desmarcada."
        : "Aula desmarcada. Sem devolução de crédito (menos de 48h de antecedência)."
  });
}
