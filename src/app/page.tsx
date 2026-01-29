import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "ALUNO") {
    redirect("/aluno/agenda");
  }
  if (session.user.role === "PROFESSOR") {
    redirect("/professor/sessoes");
  }
  redirect("/admin/sessoes");
}
