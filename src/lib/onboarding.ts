import { prisma } from "@/lib/prisma";

export async function isProfileComplete(userId: string, role: "ALUNO" | "PROFESSOR" | "ADMIN") {
  if (role === "ADMIN") return true;

  if (role === "ALUNO") {
    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    return Boolean(profile?.serie?.trim() && profile?.turma?.trim() && profile?.unidade?.trim());
  }

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    include: { subjects: true }
  });

  return Boolean(profile && profile.subjects.length > 0);
}