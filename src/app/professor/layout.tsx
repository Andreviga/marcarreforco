import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { isProfileComplete } from "@/lib/onboarding";

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["PROFESSOR"]);
  const complete = await isProfileComplete(session.user.id, "PROFESSOR");
  if (!complete) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
