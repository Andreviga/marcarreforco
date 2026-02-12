import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminPackagesClient from "@/components/AdminPackagesClient";

export default async function AdminPacotesPage() {
  await requireRole(["ADMIN"]);

  const [packages, subjects] = await Promise.all([
    prisma.sessionPackage.findMany({
      where: { billingType: "PACKAGE" },
      orderBy: { createdAt: "desc" }
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell title="Pacotes" subtitle="Gerencie pacotes e preços" role="ADMIN">
      <AdminPackagesClient
        packages={packages}
        subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
      />
    </AppShell>
  );
}
