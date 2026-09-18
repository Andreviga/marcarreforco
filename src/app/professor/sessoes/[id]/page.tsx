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
      enrollments: {
        // Inscrições desmarcadas não entram na chamada (a rota de presença
        // as recusa de qualquer forma).
        where: { status: "AGENDADO" },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              studentProfile: { select: { studentName: true } }
            }
          },
          attendance: true
        }
      }
    }
  });

  if (!session || session.teacherId !== sessionUser.user.id) {
    return (
      <AppShell title="Sessão" role="PROFESSOR">
        <p className="text-sm text-slate-500">Sessão não encontrada.</p>
      </AppShell>
    );
  }

  // O professor vê o nome do ALUNO (a conta é do responsável).
  const enrollmentsForClient = session.enrollments.map((enrollment) => ({
    ...enrollment,
    student: {
      id: enrollment.student.id,
      name: enrollment.student.studentProfile?.studentName ?? enrollment.student.name,
      email: enrollment.student.email
    }
  }));

  return (
    <AppShell title={`Chamada - ${session.subject.name}`} subtitle={session.location} role="PROFESSOR">
      <AttendanceClient sessionId={session.id} enrollments={enrollmentsForClient} />
    </AppShell>
  );
}
