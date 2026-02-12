import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { adminCreditAdjustSchema } from "@/lib/validators";
import { adjustCredits } from "@/lib/credits";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = adminCreditAdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true }
  });

  if (!user || user.role !== "ALUNO") {
    return NextResponse.json({ message: "Aluno inválido" }, { status: 404 });
  }

  const subject = await prisma.subject.findUnique({
    where: { id: parsed.data.subjectId },
    select: { id: true }
  });

  if (!subject) {
    return NextResponse.json({ message: "Disciplina inválida" }, { status: 404 });
  }

  await adjustCredits({
    studentId: parsed.data.userId,
    subjectId: parsed.data.subjectId,
    delta: parsed.data.amount,
    reason: "ADMIN_ADJUST"
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "ADMIN_ADJUST_CREDITS",
    entityType: "StudentCreditBalance",
    entityId: parsed.data.userId,
    payload: { subjectId: parsed.data.subjectId, amount: parsed.data.amount }
  });

  return NextResponse.json({ ok: true });
}
