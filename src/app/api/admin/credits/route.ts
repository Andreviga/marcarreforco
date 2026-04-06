import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";

export async function GET() {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const now = new Date();

  // All students
  const students = await prisma.user.findMany({
    where: { role: "ALUNO" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true }
  });

  if (!students.length) return NextResponse.json({ students: [] });

  const studentIds = students.map((s) => s.id);

  // Active credit lots grouped by student + subject
  const lots = await prisma.studentCreditLot.findMany({
    where: {
      studentId: { in: studentIds },
      remaining: { gt: 0 },
      expiresAt: { gt: now }
    },
    include: { subject: { select: { id: true, name: true } } },
    orderBy: { expiresAt: "asc" }
  });

  // Build map: studentId -> subjectId -> { balance, expiresAt (earliest) }
  type SubjectEntry = { subjectId: string; subjectName: string; balance: number; expiresAt: string };
  const balanceMap = new Map<string, Map<string, SubjectEntry>>();

  for (const lot of lots) {
    if (!balanceMap.has(lot.studentId)) {
      balanceMap.set(lot.studentId, new Map());
    }
    const bySubject = balanceMap.get(lot.studentId)!;
    if (bySubject.has(lot.subjectId)) {
      const entry = bySubject.get(lot.subjectId)!;
      entry.balance += lot.remaining;
      // keep earliest expiry already stored (lots are ordered asc)
    } else {
      bySubject.set(lot.subjectId, {
        subjectId: lot.subjectId,
        subjectName: lot.subject.name,
        balance: lot.remaining,
        expiresAt: lot.expiresAt.toISOString()
      });
    }
  }

  const result = students.map((student) => {
    const bySubject = balanceMap.get(student.id);
    const balances: SubjectEntry[] = bySubject
      ? Array.from(bySubject.values()).sort((a, b) =>
          a.subjectName.localeCompare(b.subjectName, "pt-BR", { sensitivity: "base" })
        )
      : [];
    const total = balances.reduce((sum, b) => sum + b.balance, 0);
    return { ...student, balances, total };
  });

  return NextResponse.json({ students: result });
}
