import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { enrollSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { addPaymentCredits, getBalance, reserveCredit } from "@/lib/credits";
import { sendEmail } from "@/lib/mail";

const MIN_ENROLL_ADVANCE_HOURS = 48;
const MIN_ENROLL_ADVANCE_MS = MIN_ENROLL_ADVANCE_HOURS * 60 * 60 * 1000;

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

  if (sessionRecord.startsAt.getTime() - Date.now() < MIN_ENROLL_ADVANCE_MS) {
    return NextResponse.json(
      { message: "Agendamento disponível somente com 48 horas de antecedência." },
      { status: 400 }
    );
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

    if (pendingPayment && wildcardSubject) {
      await addPaymentCredits({
        studentId: session.user.id,
        subjectId: wildcardSubject.id,
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

  if (session.user.email) {
    const startsAtLabel = sessionRecord.startsAt.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo"
    });
    const startTimeLabel = sessionRecord.startsAt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    });
    const endTimeLabel = sessionRecord.endsAt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    });

    const html = `
      <div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:24px 28px 8px 28px;">
                    <div style="display:inline-block;background:#ecfdf3;color:#047857;font-size:12px;font-weight:700;padding:6px 10px;border-radius:999px;">AGENDAMENTO CONFIRMADO</div>
                    <h1 style="margin:16px 0 8px 0;font-size:22px;line-height:1.3;">Olá, ${session.user.name ?? "aluno(a)"}!</h1>
                    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                      Seu agendamento foi realizado com sucesso.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 24px 28px;">
                    <p style="margin:0 0 8px 0;font-size:14px;color:#0f172a;"><strong>Disciplina:</strong> ${sessionRecord.subject.name}</p>
                    <p style="margin:0 0 8px 0;font-size:14px;color:#0f172a;"><strong>Professor(a):</strong> ${sessionRecord.teacher.name}</p>
                    <p style="margin:0 0 8px 0;font-size:14px;color:#0f172a;"><strong>Data:</strong> ${startsAtLabel}</p>
                    <p style="margin:0 0 8px 0;font-size:14px;color:#0f172a;"><strong>Horário:</strong> ${startTimeLabel} - ${endTimeLabel}</p>
                    <p style="margin:0;font-size:14px;color:#0f172a;"><strong>Modalidade:</strong> ${sessionRecord.modality === "ONLINE" ? "Online" : sessionRecord.location}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0 0;font-size:11px;color:#94a3b8;">Colégio Raízes - Reforço Escolar</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      await sendEmail({
        to: session.user.email,
        subject: "Agendamento confirmado",
        html
      });
    } catch (error) {
      console.error("Falha ao enviar e-mail de agendamento", {
        enrollmentId: enrollment.id,
        sessionId: enrollment.sessionId,
        studentId: session.user.id,
        error
      });
    }
  }

  return NextResponse.json({ enrollment });
}
