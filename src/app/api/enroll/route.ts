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

  const enrollment = await prisma.enrollment.upsert({
    where: {
      sessionId_studentId: {
        sessionId: parsed.data.sessionId,
        studentId: session.user.id
      }
    },
    update: { status: "AGENDADO" },
    create: {
      sessionId: parsed.data.sessionId,
      studentId: session.user.id,
      status: "AGENDADO"
    }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "ENROLL",
    entityType: "Enrollment",
    entityId: enrollment.id,
    payload: { sessionId: enrollment.sessionId }
  });

  return NextResponse.json({ enrollment });
}
