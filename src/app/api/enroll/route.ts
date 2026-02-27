import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { enrollSchema, isSerieEligible, isTurmaEligible } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { addPaymentCredits, getBalance, reserveCredit } from "@/lib/credits";

function enrollmentError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO"]);
  if (response) return response;

  try {
    const body = await request.json();
    const parsed = enrollSchema.safeParse(body);
    if (!parsed.success) {
      return enrollmentError("Não foi possível agendar: dados inválidos.");
    }

    const sessionRecord = await prisma.session.findUnique({
      where: { id: parsed.data.sessionId },
      include: { subject: true, teacher: true }
    });

    if (!sessionRecord || sessionRecord.status === "CANCELADA") {
      return enrollmentError("Não foi possível agendar: esta sessão não está disponível.");
    }

    if (sessionRecord.startsAt <= new Date()) {
      return enrollmentError("Não foi possível agendar: esta sessão já começou ou está fora do prazo.");
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: parsed.data.sessionId,
          studentId: session.user.id
        }
      }
    });

    if (existingEnrollment?.status === "AGENDADO") {
      return NextResponse.json({
        enrollment: existingEnrollment,
        message: "Você já está agendado nesta sessão."
      });
    }

    if (!sessionRecord.subjectId) {
      return enrollmentError("Não foi possível agendar: disciplina da sessão inválida.");
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { serie: true, turma: true }
    });

    if (!isSerieEligible(sessionRecord.subject.eligibleSeries, studentProfile?.serie)) {
      return enrollmentError("Não foi possível agendar: esta aula não está disponível para a sua série.");
    }

    if (!isTurmaEligible(sessionRecord.subject.eligibleTurmas as Array<"MANHA" | "TARDE"> | undefined, studentProfile?.turma)) {
      return enrollmentError("Não foi possível agendar: esta aula não é da sua turma.");
    }

    const currentBalance = await getBalance(session.user.id, sessionRecord.subjectId);
    if (currentBalance <= 0) {
      const pendingPayment = await prisma.asaasPayment.findFirst({
        where: {
          userId: session.user.id,
          status: "CONFIRMED",
          package: { subjectId: null },
          creditLedger: { none: { reason: "PAYMENT_CREDIT" } }
        },
        include: { package: true }
      });

      if (pendingPayment) {
        await addPaymentCredits({
          studentId: session.user.id,
          subjectId: sessionRecord.subjectId,
          amount: pendingPayment.package.sessionCount,
          paymentId: pendingPayment.id,
          paidAt: pendingPayment.paidAt
        });
      }
    }

    let enrollment;

    try {
      enrollment = await prisma.$transaction(async (tx) => {
        const updated = await tx.enrollment.upsert({
          where: {
            sessionId_studentId: {
              sessionId: parsed.data.sessionId,
              studentId: session.user.id
            }
          },
          update: { status: "AGENDADO", creditsReserved: 1 },
          create: {
            sessionId: parsed.data.sessionId,
            studentId: session.user.id,
            status: "AGENDADO",
            creditsReserved: 1
          }
        });

        await reserveCredit({
          tx,
          studentId: session.user.id,
          subjectId: sessionRecord.subjectId,
          enrollmentId: updated.id
        });

        return updated;
      });
    } catch (error) {
      if (error instanceof Error && error.message === "SEM_CREDITO") {
        return enrollmentError(
          "Não foi possível agendar: você não tem créditos disponíveis para essa disciplina."
        );
      }
      throw error;
    }

    await logAudit({
      actorUserId: session.user.id,
      action: "ENROLL",
      entityType: "Enrollment",
      entityId: enrollment.id,
      payload: { sessionId: enrollment.sessionId }
    });

    return NextResponse.json({ enrollment });
  } catch (error) {
    console.error("ENROLL_ERROR", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error)
    });

    return enrollmentError("Não foi possível agendar agora. Tente novamente em instantes.", 500);
  }
}
