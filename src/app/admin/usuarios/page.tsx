import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminUsersClient from "@/components/AdminUsersClient";

export default async function AdminUsuariosPage() {
  await requireRole(["ADMIN"]);

  const users = await prisma.user.findMany({
    include: { studentProfile: true, teacherProfile: { include: { subjects: true } } },
    orderBy: { createdAt: "desc" }
  });

  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell title="Usuários" subtitle="Gerencie perfis e acessos" role="ADMIN">
      <AdminUsersClient users={users} subjects={subjects} />
    </AppShell>
  );
}
