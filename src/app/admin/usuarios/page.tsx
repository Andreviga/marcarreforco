import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminUsersClient from "@/components/AdminUsersClient";

export default async function AdminUsuariosPage() {
  await requireRole(["ADMIN"]);

  const users = await prisma.user.findMany({
    include: { studentProfile: true, teacherProfile: { include: { subjects: { include: { subject: true } } } } },
    orderBy: { createdAt: "desc" }
  });

  const usersForClient = users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
    teacherProfile: user.teacherProfile
      ? {
          ...user.teacherProfile,
          subjects: user.teacherProfile.subjects.map((item) => item.subject)
        }
      : null
  }));

  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell title="Usuários" subtitle="Gerencie perfis e acessos" role="ADMIN">
      <AdminUsersClient users={usersForClient} subjects={subjects} />
    </AppShell>
  );
}
