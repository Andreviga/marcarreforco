import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminCreditsClient from "@/components/AdminCreditsClient";

export default async function AdminCreditosPage() {
  await requireRole(["ADMIN"]);

  const now = new Date();

  const students = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true }
  });

  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  const lots = await prisma.studentCreditLot.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
      remaining: { gt: 0 },
      expiresAt: { gt: now }
    },
    include: { subject: { select: { id: true, name: true } } },
    orderBy: { expiresAt: "asc" }
  });

  type SubjectEntry = {
    subjectId: string;
    subjectName: string;
    balance: number;
    expiresAt: string;
  };

  const balanceMap = new Map<string, Map<string, SubjectEntry>>();
  for (const lot of lots) {
    if (!balanceMap.has(lot.studentId)) balanceMap.set(lot.studentId, new Map());
    const bySubject = balanceMap.get(lot.studentId)!;
    if (bySubject.has(lot.subjectId)) {
      bySubject.get(lot.subjectId)!.balance += lot.remaining;
    } else {
      bySubject.set(lot.subjectId, {
        subjectId: lot.subjectId,
        subjectName: lot.subject.name,
        balance: lot.remaining,
        expiresAt: lot.expiresAt.toISOString()
      });
    }
  }

  const studentsData = students.map((student) => {
    const bySubject = balanceMap.get(student.id);
    const balances: SubjectEntry[] = bySubject
      ? Array.from(bySubject.values()).sort((a, b) =>
          a.subjectName.localeCompare(b.subjectName, "pt-BR", { sensitivity: "base" })
        )
      : [];
    return {
      id: student.id,
      name: student.name,
      email: student.email,
      balances,
      total: balances.reduce((sum, b) => sum + b.balance, 0)
    };
  });

  return (
    <AppShell title="Créditos" subtitle="Saldo de créditos por aluno" role="ADMIN">
      <AdminCreditsClient students={studentsData} subjects={subjects} />
    </AppShell>
  );
}
