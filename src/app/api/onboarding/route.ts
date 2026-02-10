import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { onboardingStudentSchema, onboardingTeacherSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO", "PROFESSOR"]);
  if (response) return response;

  const body = await request.json();
  const role = session.user.role;

  if (role === "ALUNO") {
    const parsed = onboardingStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
    }

    const updated = await prisma.studentProfile.upsert({
      where: { userId: session.user.id },
      update: {
        serie: parsed.data.serie,
        turma: parsed.data.turma,
        unidade: parsed.data.unidade
      },
      create: {
        userId: session.user.id,
        serie: parsed.data.serie,
        turma: parsed.data.turma,
        unidade: parsed.data.unidade
      }
    });

    return NextResponse.json({ profile: updated });
  }

  const parsed = onboardingTeacherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  await prisma.teacherProfile.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id }
  });

  await prisma.teacherSubject.deleteMany({ where: { teacherId: session.user.id } });
  await prisma.teacherSubject.createMany({
    data: parsed.data.subjectIds.map((subjectId) => ({ teacherId: session.user.id, subjectId })),
    skipDuplicates: true
  });

  return NextResponse.json({ ok: true });
}
