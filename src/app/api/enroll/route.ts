import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { enrollSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { addPaymentCredits, getBalance, reserveCredit } from "@/lib/credits";

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO"]);
  if (response) return response;

  const body = await request.json();
  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const sessionRecord = await prisma.session.findUnique({
    where: { id: parsed.data.sessionId },
    include: { subject: true, teacher: true }
  });

  if (!sessionRecord || sessionRecord.status === "CANCELADA") {
    return NextResponse.json({ message: "Sessão indisponível" }, { status: 400 });
  }

  if (sessionRecord.startsAt <= new Date()) {
    return NextResponse.json({ message: "Sessão fora do prazo" }, { status: 400 });
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
    return NextResponse.json({ enrollment: existingEnrollment });
  }

  if (!sessionRecord.subjectId) {
    return NextResponse.json({ message: "Disciplina inválida" }, { status: 400 });
  }

  const wildcardSubject = await prisma.subject.findFirst({
    where: { name: { equals: "A DEFINIR", mode: "insensitive" } },
    select: { id: true }
  });

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

      try {
        await reserveCredit({
          tx,
          studentId: session.user.id,
          subjectId: sessionRecord.subjectId,
          enrollmentId: updated.id
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "SEM_CREDITO" &&
          wildcardSubject &&
          wildcardSubject.id !== sessionRecord.subjectId
        ) {
          await reserveCredit({
            tx,
            studentId: session.user.id,
            subjectId: wildcardSubject.id,
            enrollmentId: updated.id
          });
        } else {
          throw error;
        }
      }

      return updated;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SEM_CREDITO") {
      return NextResponse.json({ message: "Saldo insuficiente para agendar." }, { status: 400 });
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
}
