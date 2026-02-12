import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { enrollSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

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

  let enrollment;

  try {
    enrollment = await prisma.$transaction(async (tx) => {
      const balance = await tx.studentCreditBalance.findUnique({
        where: {
          studentId_subjectId: { studentId: session.user.id, subjectId: sessionRecord.subjectId }
        }
      });

      if (!balance || balance.balance < 1) {
        throw new Error("SEM_CREDITO");
      }

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

      await tx.studentCreditBalance.update({
        where: {
          studentId_subjectId: { studentId: session.user.id, subjectId: sessionRecord.subjectId }
        },
        data: { balance: { decrement: 1 } }
      });

      await tx.studentCreditLedger.create({
        data: {
          studentId: session.user.id,
          subjectId: sessionRecord.subjectId,
          delta: -1,
          reason: "ENROLL_RESERVE",
          enrollmentId: updated.id
        }
      });

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
