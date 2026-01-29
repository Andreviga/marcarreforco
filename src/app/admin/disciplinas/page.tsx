import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminSubjectsClient from "@/components/AdminSubjectsClient";

export default async function AdminDisciplinasPage() {
  await requireRole(["ADMIN"]);

  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell title="Disciplinas" subtitle="Gerencie o catálogo" role="ADMIN">
      <AdminSubjectsClient subjects={subjects} />
    </AppShell>
  );
}
