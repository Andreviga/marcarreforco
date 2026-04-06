import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { adminEnrollSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { addPaymentCredits, getBalance, reserveCredit } from "@/lib/credits";

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = adminEnrollSchema.safeParse(body);
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

  // Admin bypasses the 48-hour advance booking rule

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      sessionId_studentId: {
        sessionId: parsed.data.sessionId,
        studentId: parsed.data.studentId
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

  const currentBalance = await getBalance(parsed.data.studentId, sessionRecord.subjectId);
  if (currentBalance <= 0) {
    const pendingPayment = await prisma.asaasPayment.findFirst({
      where: {
        userId: parsed.data.studentId,
        status: "CONFIRMED",
        package: { subjectId: null },
        creditLedger: { none: { reason: "PAYMENT_CREDIT" } }
      },
      include: { package: true }
    });

    if (pendingPayment) {
      await addPaymentCredits({
        studentId: parsed.data.studentId,
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
            studentId: parsed.data.studentId
          }
        },
        update: { status: "AGENDADO", creditsReserved: 1 },
        create: {
          sessionId: parsed.data.sessionId,
          studentId: parsed.data.studentId,
          status: "AGENDADO",
          creditsReserved: 1
        }
      });

      try {
        await reserveCredit({
          tx,
          studentId: parsed.data.studentId,
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
            studentId: parsed.data.studentId,
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
    action: "ADMIN_ENROLL",
    entityType: "Enrollment",
    entityId: enrollment.id,
    payload: { sessionId: enrollment.sessionId, studentId: parsed.data.studentId }
  });

  return NextResponse.json({ enrollment });
}
