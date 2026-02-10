import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { isProfileComplete } from "@/lib/onboarding";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["ALUNO"]);
  const complete = await isProfileComplete(session.user.id, "ALUNO");
  if (!complete) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
