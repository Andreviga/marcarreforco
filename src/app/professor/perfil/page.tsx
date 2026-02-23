import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import ProfileClient from "@/components/ProfileClient";

export default async function ProfessorProfilePage() {
  const session = await requireRole(["PROFESSOR"]);

  const [user, subjects] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teacherProfile: {
          select: {
            subjects: {
              select: {
                subject: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true
      }
    })
  ]);

  if (!user) {
    throw new Error("Usuário não encontrado");
  }

  return (
    <AppShell title="Meu Perfil" subtitle="Gerencie seus dados pessoais" role="PROFESSOR">
      <ProfileClient initialUser={user} subjects={subjects} />
    </AppShell>
  );
}
