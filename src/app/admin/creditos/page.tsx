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

  const studentIds = students.map((s) => s.id);

  const lots = await prisma.studentCreditLot.findMany({
    where: {
      studentId: { in: studentIds },
      remaining: { gt: 0 },
      expiresAt: { gt: now }
    },
    include: { subject: { select: { id: true, name: true } } },
    orderBy: { expiresAt: "asc" }
  });

  // Total credits ever received per student per subject
  const receivedLedger = await prisma.studentCreditLedger.groupBy({
    by: ["studentId", "subjectId"],
    where: {
      studentId: { in: studentIds },
      delta: { gt: 0 }
    },
    _sum: { delta: true }
  });

  // Active (AGENDADO) enrollments in ATIVA sessions per student per subject
  const activeEnrollments = await prisma.enrollment.findMany({
    where: {
      studentId: { in: studentIds },
      status: "AGENDADO",
      session: { status: "ATIVA" }
    },
    select: {
      studentId: true,
      creditsReserved: true,
      session: { select: { subjectId: true, startsAt: true } }
    }
  });

  type SubjectEntry = {
    subjectId: string;
    subjectName: string;
    balance: number;
    expiresAt: string;
    received: number;
    enrolled: number;
  };

  // Build received map: studentId -> subjectId -> total received
  const receivedMap = new Map<string, Map<string, number>>();
  for (const row of receivedLedger) {
    if (!receivedMap.has(row.studentId)) receivedMap.set(row.studentId, new Map());
    receivedMap.get(row.studentId)!.set(row.subjectId, row._sum.delta ?? 0);
  }

  // Build enrolled map: studentId -> subjectId -> count of active enrollments
  const enrolledMap = new Map<string, Map<string, number>>();
  for (const enr of activeEnrollments) {
    const subjectId = enr.session.subjectId;
    if (!enrolledMap.has(enr.studentId)) enrolledMap.set(enr.studentId, new Map());
    const m = enrolledMap.get(enr.studentId)!;
    m.set(subjectId, (m.get(subjectId) ?? 0) + 1);
  }

  // Build all subject names touched per student (lots + received + enrolled)
  const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

  const balanceMap = new Map<string, Map<string, SubjectEntry>>();
  for (const lot of lots) {
    if (!balanceMap.has(lot.studentId)) balanceMap.set(lot.studentId, new Map());
    const bySubject = balanceMap.get(lot.studentId)!;
    const existing = bySubject.get(lot.subjectId);
    if (existing) {
      existing.balance += lot.remaining;
    } else {
      bySubject.set(lot.subjectId, {
        subjectId: lot.subjectId,
        subjectName: lot.subject.name,
        balance: lot.remaining,
        expiresAt: lot.expiresAt.toISOString(),
        received: receivedMap.get(lot.studentId)?.get(lot.subjectId) ?? 0,
        enrolled: enrolledMap.get(lot.studentId)?.get(lot.subjectId) ?? 0
      });
    }
  }

  // Add subjects that appear in received/enrolled but have no active lots
  for (const [studentId, byReceivedSubject] of receivedMap) {
    if (!balanceMap.has(studentId)) balanceMap.set(studentId, new Map());
    const bySubject = balanceMap.get(studentId)!;
    for (const [subjectId, rec] of byReceivedSubject) {
      if (!bySubject.has(subjectId)) {
        bySubject.set(subjectId, {
          subjectId,
          subjectName: subjectNameMap.get(subjectId) ?? subjectId,
          balance: 0,
          expiresAt: new Date(0).toISOString(),
          received: rec,
          enrolled: enrolledMap.get(studentId)?.get(subjectId) ?? 0
        });
      } else {
        // Backfill received/enrolled that may have been missed (lots added before received map)
        const entry = bySubject.get(subjectId)!;
        if (entry.received === 0) entry.received = rec;
      }
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
