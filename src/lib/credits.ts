import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CREDIT_TTL_DAYS = 30;

type DbClient = Prisma.TransactionClient | typeof prisma;

// Serializa operações concorrentes sobre a mesma chave (ex.: mesmo pagamento)
// dentro da transação atual, sem exigir mudanças de schema.
async function lockKey(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

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
    // Decremento condicional: outra transação pode ter consumido o lote
    // entre a leitura e a escrita — nunca deixar `remaining` negativo.
    const applied = await tx.studentCreditLot.updateMany({
      where: { id: lot.id, remaining: { gte: used } },
      data: { remaining: { decrement: used } }
    });
    if (applied.count === 0) continue;
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
    if (paymentId) {
      // Idempotência: webhook, alocação manual e crédito automático no
      // agendamento podem disparar ao mesmo tempo para o mesmo pagamento.
      // A comparação é pelo saldo líquido (créditos - revogações), para que
      // um pagamento estornado e depois refeito no Asaas possa creditar de novo.
      await lockKey(tx, `payment-credit:${paymentId}`);
      const history = await tx.studentCreditLedger.findMany({
        where: {
          paymentId,
          OR: [{ reason: "PAYMENT_CREDIT" }, { reason: "ADMIN_ADJUST", delta: { lt: 0 } }]
        },
        select: { delta: true, reason: true, creditLotId: true }
      });
      const netCredited = history.reduce((sum, entry) => sum + entry.delta, 0);
      if (netCredited > 0) {
        const lastCredit = history.find((entry) => entry.reason === "PAYMENT_CREDIT");
        return lastCredit?.creditLotId
          ? tx.studentCreditLot.findUnique({ where: { id: lastCredit.creditLotId } })
          : null;
      }
    }
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

    const consumed = await consumeLots({
      tx,
      studentId,
      subjectId,
      amount: Math.abs(delta),
      reason,
      paymentId
    });
    return { consumed };
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

  // Guarda contra reserva dupla: duas requisições simultâneas para a mesma
  // inscrição (duplo clique) chegam aqui serializadas pelo lock de linha da
  // enrollment; a segunda enxerga a reserva já feita e não debita de novo.
  const ledger = await tx.studentCreditLedger.findMany({
    where: { enrollmentId, reason: { in: ["ENROLL_RESERVE", "ENROLL_RELEASE"] } },
    select: { delta: true }
  });
  const outstanding = ledger.reduce((sum, entry) => sum - entry.delta, 0);
  if (outstanding > 0) {
    return;
  }

  const lots = await getAvailableLots(tx, studentId, subjectId, now);
  if (!lots.length) {
    throw new Error("SEM_CREDITO");
  }

  let reservedLotId: string | null = null;
  for (const lot of lots) {
    // Decremento condicional para nunca gastar o mesmo crédito duas vezes
    // em transações concorrentes (o saldo jamais fica negativo).
    const applied = await tx.studentCreditLot.updateMany({
      where: { id: lot.id, remaining: { gte: 1 } },
      data: { remaining: { decrement: 1 } }
    });
    if (applied.count > 0) {
      reservedLotId = lot.id;
      break;
    }
  }

  if (!reservedLotId) {
    throw new Error("SEM_CREDITO");
  }

  await tx.studentCreditLedger.create({
    data: {
      studentId,
      subjectId,
      delta: -1,
      reason: "ENROLL_RESERVE",
      enrollmentId,
      creditLotId: reservedLotId
    }
  });

  await recalcBalance(tx, studentId, subjectId, now);
}

// Estorna exatamente o que restou dos lotes criados por um pagamento
// (usado em REFUNDED/CANCELED). Idempotente: só zera lotes com saldo.
export async function revokePaymentCredits(paymentId: string) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await lockKey(tx, `payment-credit:${paymentId}`);
    // Zera os lotes atomicamente (FOR UPDATE captura o valor exato revogado
    // mesmo com reservas concorrentes decrementando o mesmo lote).
    const zeroed = await tx.$queryRaw<
      Array<{ id: string; studentId: string; subjectId: string; revoked: number }>
    >`
      UPDATE "StudentCreditLot" AS l
      SET "remaining" = 0
      FROM (
        SELECT "id", "studentId", "subjectId", "remaining" AS old
        FROM "StudentCreditLot"
        WHERE "paymentId" = ${paymentId} AND "remaining" > 0
        FOR UPDATE
      ) AS s
      WHERE l."id" = s."id"
      RETURNING l."id" AS id, s."studentId" AS "studentId", s."subjectId" AS "subjectId", s.old AS revoked
    `;

    let revoked = 0;
    for (const lot of zeroed) {
      await tx.studentCreditLedger.create({
        data: {
          studentId: lot.studentId,
          subjectId: lot.subjectId,
          delta: -Number(lot.revoked),
          reason: "ADMIN_ADJUST",
          paymentId,
          creditLotId: lot.id
        }
      });
      revoked += Number(lot.revoked);
      await recalcBalance(tx, lot.studentId, lot.subjectId, now);
    }
    return revoked;
  });
}

export async function releaseCredit(params: {
  tx: Prisma.TransactionClient;
  studentId: string;
  // A devolução vai para o lote de origem (registrado no ledger), então a
  // disciplina não precisa ser informada.
  subjectId?: string;
  enrollmentId: string;
}) {
  const { tx, studentId, enrollmentId } = params;
  const now = new Date();

  // Idempotência: se tudo que foi reservado já foi devolvido (cancelamento
  // concorrente pelo aluno e pelo admin, por exemplo), não devolve de novo.
  const movements = await tx.studentCreditLedger.findMany({
    where: { enrollmentId, reason: { in: ["ENROLL_RESERVE", "ENROLL_RELEASE"] } },
    select: { delta: true }
  });
  const outstanding = movements.reduce((sum, entry) => sum - entry.delta, 0);
  if (outstanding <= 0) {
    return false;
  }

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
  if (!lot) {
    return false;
  }

  // Pagamento estornado/cancelado: os créditos daquele lote foram revogados;
  // desmarcar a aula não pode ressuscitá-los.
  if (lot.paymentId) {
    const revoked = await tx.studentCreditLedger.findFirst({
      where: { paymentId: lot.paymentId, reason: "ADMIN_ADJUST", delta: { lt: 0 } },
      select: { id: true }
    });
    if (revoked) {
      return false;
    }
  }

  // O lote expirou entre a reserva e o cancelamento: o aluno reservou dentro
  // da validade, então a devolução não pode evaporar — cria um lote de
  // reposição com fôlego curto (7 dias) para o crédito ser reutilizado.
  if (lot.expiresAt <= now) {
    const replacement = await tx.studentCreditLot.create({
      data: {
        studentId: lot.studentId,
        subjectId: lot.subjectId,
        paymentId: lot.paymentId,
        total: 1,
        remaining: 1,
        expiresAt: addDays(now, 7)
      }
    });
    await tx.studentCreditLedger.create({
      data: {
        studentId,
        subjectId: lot.subjectId,
        delta: 1,
        reason: "ENROLL_RELEASE",
        enrollmentId,
        creditLotId: replacement.id
      }
    });
    await recalcBalance(tx, studentId, lot.subjectId, now);
    return true;
  }

  await tx.studentCreditLot.update({
    where: { id: lot.id },
    data: { remaining: { increment: 1 } }
  });

  await tx.studentCreditLedger.create({
    data: {
      studentId,
      subjectId: lot.subjectId,
      delta: 1,
      reason: "ENROLL_RELEASE",
      enrollmentId,
      creditLotId: lot.id
    }
  });

  await recalcBalance(tx, studentId, lot.subjectId, now);
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
  const [lots, legacyBalances] = await Promise.all([
    prisma.studentCreditLot.findMany({
      where: {
        studentId,
        remaining: { gt: 0 },
        expiresAt: { gt: now }
      }
    }),
    prisma.studentCreditBalance.findMany({
      where: {
        studentId,
        balance: { gt: 0 }
      }
    })
  ]);

  const lotBySubject = new Map<string, number>();
  for (const lot of lots) {
    lotBySubject.set(lot.subjectId, (lotBySubject.get(lot.subjectId) ?? 0) + lot.remaining);
  }

  const legacyBySubject = new Map<string, number>();
  for (const item of legacyBalances) {
    legacyBySubject.set(item.subjectId, item.balance);
  }

  const subjectIds = Array.from(new Set([...lotBySubject.keys(), ...legacyBySubject.keys()]));
  if (!subjectIds.length) return [];

  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    orderBy: { name: "asc" }
  });

  return subjects
    .map((subject) => ({
      subject,
      // Preferir lotes ativos e válidos; usar legado apenas como fallback.
      balance: lotBySubject.has(subject.id)
        ? lotBySubject.get(subject.id) ?? 0
        : legacyBySubject.get(subject.id) ?? 0
    }))
    .filter((item) => item.balance > 0);
}
