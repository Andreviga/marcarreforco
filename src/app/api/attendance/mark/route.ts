import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { attendanceMarkSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["PROFESSOR", "ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = attendanceMarkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    include: { session: true }
  });

  if (!enrollment) {
    return NextResponse.json({ message: "Inscrição não encontrada" }, { status: 404 });
  }

  if (enrollment.status !== "AGENDADO") {
    return NextResponse.json({ message: "Inscrição desmarcada" }, { status: 400 });
  }

  if (enrollment.session.status === "CANCELADA") {
    return NextResponse.json({ message: "Sessão cancelada" }, { status: 400 });
  }

  // Professor só pode marcar presença nas próprias sessões (admin pode em todas).
  if (session.user.role === "PROFESSOR" && enrollment.session.teacherId !== session.user.id) {
    return NextResponse.json({ message: "Sessão de outro professor" }, { status: 403 });
  }

  const attendance = await prisma.attendance.upsert({
    where: { enrollmentId: enrollment.id },
    update: {
      status: parsed.data.status,
      note: parsed.data.note,
      markedByUserId: session.user.id,
      markedAt: new Date()
    },
    create: {
      sessionId: enrollment.sessionId,
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      status: parsed.data.status,
      note: parsed.data.note,
      markedByUserId: session.user.id
    }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "MARK_ATTENDANCE",
    entityType: "Attendance",
    entityId: attendance.id,
    payload: { enrollmentId: enrollment.id, status: attendance.status }
  });

  return NextResponse.json({ attendance });
}
