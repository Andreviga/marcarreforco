import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CREDIT_TTL_DAYS = 30;

type DbClient = Prisma.TransactionClient | typeof prisma;

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getExpiryDate(base?: Date | null) {
  return addDays(base ?? new Date(), CREDIT_TTL_DAYS);
}

async function ensureLegacyLot(db: DbClient, studentId: string, subjectId: string, now: Date) {
  const existingLot = await db.studentCreditLot.findFirst({
    where: { studentId, subjectId }
  });
  if (existingLot) return;

  const legacyBalance = await db.studentCreditBalance.findUnique({
    where: { studentId_subjectId: { studentId, subjectId } }
  });
  if (!legacyBalance || legacyBalance.balance <= 0) return;

  await db.studentCreditLot.create({
    data: {
      studentId,
      subjectId,
      total: legacyBalance.balance,
      remaining: legacyBalance.balance,
      expiresAt: getExpiryDate(legacyBalance.updatedAt ?? now)
    }
  });
}

async function recalcBalance(db: DbClient, studentId: string, subjectId: string, now: Date) {
  const aggregate = await db.studentCreditLot.aggregate({
    where: {
      studentId,
      subjectId,
      remaining: { gt: 0 },
      expiresAt: { gt: now }
    },
    _sum: { remaining: true }
  });
  const total = aggregate._sum.remaining ?? 0;
  await db.studentCreditBalance.upsert({
    where: { studentId_subjectId: { studentId, subjectId } },
    update: { balance: total },
    create: { studentId, subjectId, balance: total }
  });
  return total;
}

async function getAvailableLots(db: DbClient, studentId: string, subjectId: string, now: Date) {
  await ensureLegacyLot(db, studentId, subjectId, now);
  return db.studentCreditLot.findMany({
    where: {
      studentId,
      subjectId,
      remaining: { gt: 0 },
      expiresAt: { gt: now }
    },
    orderBy: { expiresAt: "asc" }
  });
}

async function consumeLots(params: {
  tx: Prisma.TransactionClient;
  studentId: string;
  subjectId: string;
  amount: number;
  reason: "ENROLL_RESERVE" | "ADMIN_ADJUST";
  enrollmentId?: string;
  paymentId?: string;
}) {
  const { tx, studentId, subjectId, amount, reason, enrollmentId, paymentId } = params;
  const now = new Date();
  const lots = await getAvailableLots(tx, studentId, subjectId, now);
  let remaining = amount;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const used = Math.min(lot.remaining, remaining);
    await tx.studentCreditLot.update({
      where: { id: lot.id },
      data: { remaining: { decrement: used } }
    });
    await tx.studentCreditLedger.create({
      data: {
        studentId,
        subjectId,
        delta: -used,
        reason,
        enrollmentId,
        paymentId,
        creditLotId: lot.id
      }
    });
    remaining -= used;
  }

  await recalcBalance(tx, studentId, subjectId, now);
  return amount - remaining;
}

export async function addPaymentCredits(params: {
  studentId: string;
  subjectId: string;
  amount: number;
  paymentId?: string;
  paidAt?: Date | null;
}) {
  const { studentId, subjectId, amount, paymentId, paidAt } = params;
  const now = new Date();
  const expiresAt = getExpiryDate(paidAt ?? now);

  return prisma.$transaction(async (tx) => {
    await ensureLegacyLot(tx, studentId, subjectId, now);
    const lot = await tx.studentCreditLot.create({
      data: {
        studentId,
        subjectId,
        paymentId,
        total: amount,
        remaining: amount,
        expiresAt
      }
    });

    await tx.studentCreditLedger.create({
      data: {
        studentId,
        subjectId,
        delta: amount,
        reason: "PAYMENT_CREDIT",
        paymentId,
        creditLotId: lot.id
      }
    });

    await recalcBalance(tx, studentId, subjectId, now);
    return lot;
  });
}

export async function adjustCredits(params: {
  studentId: string;
  subjectId: string;
  delta: number;
  reason: "ADMIN_ADJUST";
  paymentId?: string;
}) {
  const { studentId, subjectId, delta, reason, paymentId } = params;
  if (!delta) return null;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await ensureLegacyLot(tx, studentId, subjectId, now);

    if (delta > 0) {
      const lot = await tx.studentCreditLot.create({
        data: {
          studentId,
          subjectId,
          paymentId,
          total: delta,
          remaining: delta,
          expiresAt: getExpiryDate(now)
        }
      });
      await tx.studentCreditLedger.create({
        data: {
          studentId,
          subjectId,
          delta,
          reason,
          paymentId,
          creditLotId: lot.id
        }
      });
      await recalcBalance(tx, studentId, subjectId, now);
      return lot;
    }

    await consumeLots({
      tx,
      studentId,
      subjectId,
      amount: Math.abs(delta),
      reason,
      paymentId
    });
    return null;
  });
}

export async function reserveCredit(params: {
  tx: Prisma.TransactionClient;
  studentId: string;
  subjectId: string;
  enrollmentId: string;
}) {
  const { tx, studentId, subjectId, enrollmentId } = params;
  const now = new Date();
  const lots = await getAvailableLots(tx, studentId, subjectId, now);
  if (!lots.length) {
    throw new Error("SEM_CREDITO");
  }

  const lot = lots[0];
  await tx.studentCreditLot.update({
    where: { id: lot.id },
    data: { remaining: { decrement: 1 } }
  });

  await tx.studentCreditLedger.create({
    data: {
      studentId,
      subjectId,
      delta: -1,
      reason: "ENROLL_RESERVE",
      enrollmentId,
      creditLotId: lot.id
    }
  });

  await recalcBalance(tx, studentId, subjectId, now);
}

export async function releaseCredit(params: {
  tx: Prisma.TransactionClient;
  studentId: string;
  subjectId: string;
  enrollmentId: string;
}) {
  const { tx, studentId, subjectId, enrollmentId } = params;
  const now = new Date();

  const reservation = await tx.studentCreditLedger.findFirst({
    where: {
      enrollmentId,
      reason: "ENROLL_RESERVE",
      creditLotId: { not: null }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!reservation?.creditLotId) return false;

  const lot = await tx.studentCreditLot.findUnique({
    where: { id: reservation.creditLotId }
  });
  if (!lot || lot.expiresAt <= now) {
    return false;
  }

  await tx.studentCreditLot.update({
    where: { id: lot.id },
    data: { remaining: { increment: 1 } }
  });

  await tx.studentCreditLedger.create({
    data: {
      studentId,
      subjectId,
      delta: 1,
      reason: "ENROLL_RELEASE",
      enrollmentId,
      creditLotId: lot.id
    }
  });

  await recalcBalance(tx, studentId, subjectId, now);
  return true;
}

export async function getBalance(studentId: string, subjectId: string) {
  const now = new Date();
  const aggregate = await prisma.studentCreditLot.aggregate({
    where: {
      studentId,
      subjectId,
      remaining: { gt: 0 },
      expiresAt: { gt: now }
    },
    _sum: { remaining: true }
  });
  return aggregate._sum.remaining ?? 0;
}

export async function getBalancesForStudent(studentId: string) {
  const now = new Date();
  const subjects = await prisma.subject.findMany();
  const lots = await prisma.studentCreditLot.findMany({
    where: {
      studentId,
      remaining: { gt: 0 },
      expiresAt: { gt: now }
    }
  });

  const bySubject = new Map<string, number>();
  for (const lot of lots) {
    bySubject.set(lot.subjectId, (bySubject.get(lot.subjectId) ?? 0) + lot.remaining);
  }

  return subjects
    .filter((subject) => bySubject.has(subject.id))
    .map((subject) => ({
      subject,
      balance: bySubject.get(subject.id) ?? 0
    }));
}
