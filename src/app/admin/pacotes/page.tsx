import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminPackagesClient from "@/components/AdminPackagesClient";

export default async function AdminPacotesPage() {
  await requireRole(["ADMIN"]);

  const packages = await prisma.sessionPackage.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <AppShell title="Pacotes" subtitle="Gerencie pacotes e preços" role="ADMIN">
      <AdminPackagesClient packages={packages} />
    </AppShell>
  );
}
