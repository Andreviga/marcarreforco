import { requireRole } from "@/lib/rbac";

// Defesa em profundidade: além do middleware, toda página nova sob /admin
// nasce protegida mesmo que esqueça o requireRole próprio.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["ADMIN"]);
  return <>{children}</>;
}
