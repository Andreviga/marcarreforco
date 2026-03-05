import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import ProfileClient from "@/components/ProfileClient";

export default async function AlunoProfilePage() {
  const session = await requireRole(["ALUNO"]);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      studentProfile: {
        select: {
          serie: true,
          turma: true,
          unidade: true,
          responsavel: true,
          document: true
        }
      }
    }
  });

  if (!user) {
    throw new Error("Usuário não encontrado");
  }

  return (
    <AppShell title="Meu Perfil" subtitle="Gerencie seus dados pessoais" role="ALUNO">
      <ProfileClient initialUser={user} subjects={[]} />
    </AppShell>
  );
}
