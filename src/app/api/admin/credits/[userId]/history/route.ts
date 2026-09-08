import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const reasonLabels: Record<string, string> = {
  PAYMENT_CREDIT: "Pagamento",
  ENROLL_RESERVE: "Reserva de sessão",
  ENROLL_RELEASE: "Devolução de crédito",
  ADMIN_ADJUST: "Ajuste manual"
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Rota de API responde 401/403 em JSON, nunca redirect de página.
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const { userId } = await params;

  const entries = await prisma.studentCreditLedger.findMany({
    where: { studentId: userId },
    include: {
      subject: { select: { id: true, name: true } },
      enrollment: {
        include: {
          session: {
            select: {
              startsAt: true,
              subject: { select: { name: true } }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return Response.json(
    entries.map((e) => ({
      id: e.id,
      subjectName: e.subject.name,
      delta: e.delta,
      reason: e.reason,
      reasonLabel: reasonLabels[e.reason] ?? e.reason,
      sessionDate: e.enrollment?.session?.startsAt ?? null,
      createdAt: e.createdAt
    }))
  );
}
