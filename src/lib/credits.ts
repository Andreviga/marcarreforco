import { prisma } from "@/lib/prisma";

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

async function resetBalanceIfNewMonth(params: {
  studentId: string;
  subjectId: string;
  now: Date;
}) {
  const { studentId, subjectId, now } = params;
  const balance = await prisma.studentCreditBalance.findUnique({
    where: { studentId_subjectId: { studentId, subjectId } }
  });

  if (!balance) return null;
  if (isSameMonth(balance.updatedAt, now)) return balance;

  return prisma.studentCreditBalance.update({
    where: { studentId_subjectId: { studentId, subjectId } },
    data: { balance: 0 }
  });
}

export async function getBalance(studentId: string, subjectId: string) {
  const now = new Date();
  const balance = await resetBalanceIfNewMonth({ studentId, subjectId, now });
  if (balance) return balance.balance;

  const existing = await prisma.studentCreditBalance.findUnique({
    where: { studentId_subjectId: { studentId, subjectId } }
  });
  return existing?.balance ?? 0;
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
    const now = new Date();
    const existing = await tx.studentCreditBalance.findUnique({
      where: { studentId_subjectId: { studentId, subjectId } }
    });

    if (existing && !isSameMonth(existing.updatedAt, now)) {
      await tx.studentCreditBalance.update({
        where: { studentId_subjectId: { studentId, subjectId } },
        data: { balance: 0 }
      });
    }

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

export async function getBalancesForStudent(studentId: string) {
  const now = new Date();
  const balances = await prisma.studentCreditBalance.findMany({
    where: { studentId },
    include: { subject: true }
  });

  const expiredIds = balances
    .filter((item) => !isSameMonth(item.updatedAt, now) && item.balance !== 0)
    .map((item) => item.id);

  if (expiredIds.length) {
    await prisma.studentCreditBalance.updateMany({
      where: { id: { in: expiredIds } },
      data: { balance: 0 }
    });
    return balances.map((item) => ({
      ...item,
      balance: isSameMonth(item.updatedAt, now) ? item.balance : 0
    }));
  }

  return balances;
}
