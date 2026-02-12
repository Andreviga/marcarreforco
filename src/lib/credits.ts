import { prisma } from "@/lib/prisma";

export async function getBalance(studentId: string, subjectId: string) {
  const balance = await prisma.studentCreditBalance.findUnique({
    where: { studentId_subjectId: { studentId, subjectId } }
  });
  return balance?.balance ?? 0;
}

export async function addCredits(params: {
  studentId: string;
  subjectId: string;
  delta: number;
  reason: "PAYMENT_CREDIT" | "ENROLL_RESERVE" | "ENROLL_RELEASE" | "ADMIN_ADJUST";
  enrollmentId?: string;
  paymentId?: string;
}) {
  const { studentId, subjectId, delta, reason, enrollmentId, paymentId } = params;

  return prisma.$transaction(async (tx) => {
    const balance = await tx.studentCreditBalance.upsert({
      where: { studentId_subjectId: { studentId, subjectId } },
      update: { balance: { increment: delta } },
      create: { studentId, subjectId, balance: delta }
    });

    const ledger = await tx.studentCreditLedger.create({
      data: {
        studentId,
        subjectId,
        delta,
        reason,
        enrollmentId,
        paymentId
      }
    });

    return { balance, ledger };
  });
}
