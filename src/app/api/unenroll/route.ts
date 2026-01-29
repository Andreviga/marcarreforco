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

  const updated = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { status: "DESMARCADO" }
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
