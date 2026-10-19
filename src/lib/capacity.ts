import type { Prisma } from "@prisma/client";

export const SESSION_FULL = "SESSAO_LOTADA";

// Garante que ainda há vaga na sessão. Roda DENTRO da transação da inscrição:
// o lock por sessão serializa inscrições simultâneas, então duas pessoas
// disputando a última vaga nunca passam do limite. `studentId` é excluído da
// contagem para que uma reinscrição (aluno que havia desmarcado) não conte
// contra si mesma.
export async function assertSessionHasRoom(
  tx: Prisma.TransactionClient,
  sessionId: string,
  studentId: string
) {
  const lockKey = `session-capacity:${sessionId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

  const record = await tx.session.findUnique({
    where: { id: sessionId },
    select: { capacity: true }
  });
  if (!record) return;

  const taken = await tx.enrollment.count({
    where: { sessionId, status: "AGENDADO", studentId: { not: studentId } }
  });
  if (taken >= record.capacity) {
    throw new Error(SESSION_FULL);
  }
}
