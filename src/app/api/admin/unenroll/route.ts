import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { unenrollSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { releaseCredit } from "@/lib/credits";

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
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

  if (!enrollment) {
    return NextResponse.json({ message: "Inscrição não encontrada" }, { status: 404 });
  }

  if (enrollment.status === "DESMARCADO") {
    return NextResponse.json({ message: "Inscrição já cancelada" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "DESMARCADO" }
    });

    const shouldRefund =
      record.creditsReserved > 0 && enrollment.session.subjectId;

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
    action: "ADMIN_UNENROLL",
    entityType: "Enrollment",
    entityId: updated.id,
    payload: { sessionId: updated.sessionId, studentId: enrollment.studentId }
  });

  return NextResponse.json({ enrollment: updated });
}
