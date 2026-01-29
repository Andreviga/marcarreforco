import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AttendanceClient from "@/components/AttendanceClient";

export default async function ProfessorSessaoDetailPage({ params }: { params: { id: string } }) {
  const sessionUser = await requireRole(["PROFESSOR"]);

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      subject: true,
      enrollments: { include: { student: true, attendance: true } }
    }
  });

  if (!session || session.teacherId !== sessionUser.user.id) {
    return (
      <AppShell title="Sessão" role="PROFESSOR">
        <p className="text-sm text-slate-500">Sessão não encontrada.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Chamada - ${session.subject.name}`} subtitle={session.location} role="PROFESSOR">
      <AttendanceClient sessionId={session.id} enrollments={session.enrollments} />
    </AppShell>
  );
}
