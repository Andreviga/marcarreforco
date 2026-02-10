import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { isProfileComplete } from "@/lib/onboarding";
import OnboardingClient from "@/components/OnboardingClient";

export default async function OnboardingPage() {
  const session = await requireRole(["ALUNO", "PROFESSOR", "ADMIN"]);
  const role = session.user.role as "ALUNO" | "PROFESSOR" | "ADMIN";

  if (role === "ADMIN") {
    redirect("/admin/sessoes");
  }

  const complete = await isProfileComplete(session.user.id, role);
  if (complete) {
    redirect(role === "ALUNO" ? "/aluno/agenda" : "/professor/sessoes");
  }

  if (role === "ALUNO") {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
          <OnboardingClient
            role="ALUNO"
            subjects={[]}
            initialSerie={profile?.serie ?? ""}
            initialTurma={profile?.turma ?? ""}
            initialUnidade={profile?.unidade ?? "Colégio Raízes"}
          />
        </div>
      </div>
    );
  }

  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    include: { subjects: true }
  });
  const initialSubjectIds = teacherProfile?.subjects.map((item) => item.subjectId) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
        <OnboardingClient
          role="PROFESSOR"
          subjects={subjects}
          initialSubjectIds={initialSubjectIds}
        />
      </div>
    </div>
  );
}
