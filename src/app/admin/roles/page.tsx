import { requireRole } from "@/lib/rbac";
import AppShell from "@/components/AppShell";
import CheckRolesClient from "@/components/CheckRolesClient";

export default async function CheckRolesPage() {
  await requireRole(["ADMIN"]);

  return (
    <AppShell title="Gerenciar Permissões" subtitle="Visualize e altere as roles dos usuários" role="ADMIN">
      <CheckRolesClient />
    </AppShell>
  );
}
