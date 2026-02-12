import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { unenrollSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

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

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "DESMARCADO" }
    });

    const shouldRefund =
      record.creditsReserved > 0 && enrollment.session.startsAt > new Date() && enrollment.session.subjectId;

    if (shouldRefund) {
      await tx.studentCreditBalance.upsert({
        where: {
          studentId_subjectId: { studentId: enrollment.studentId, subjectId: enrollment.session.subjectId }
        },
        update: { balance: { increment: 1 } },
        create: { studentId: enrollment.studentId, subjectId: enrollment.session.subjectId, balance: 1 }
      });

      await tx.studentCreditLedger.create({
        data: {
          studentId: enrollment.studentId,
          subjectId: enrollment.session.subjectId,
          delta: 1,
          reason: "ENROLL_RELEASE",
          enrollmentId: enrollment.id
        }
      });

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
