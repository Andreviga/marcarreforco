import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { creditAllocationSchema } from "@/lib/validators";
import { addPaymentCredits } from "@/lib/credits";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO"]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = creditAllocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const payment = await prisma.asaasPayment.findUnique({
    where: { id: parsed.data.paymentId },
    include: { package: true, creditLedger: true }
  });

  if (!payment || payment.userId !== session.user.id) {
    return NextResponse.json({ message: "Pagamento não encontrado" }, { status: 404 });
  }

  if (payment.status !== "CONFIRMED") {
    return NextResponse.json({ message: "Pagamento ainda não confirmado" }, { status: 400 });
  }

  const alreadyCredited = payment.creditLedger.some((entry) => entry.reason === "PAYMENT_CREDIT");
  if (alreadyCredited) {
    return NextResponse.json({ message: "Crédito já aplicado" }, { status: 400 });
  }

  await addPaymentCredits({
    studentId: payment.userId,
    subjectId: payment.package.subjectId ?? "",
    amount: payment.package.sessionCount,
    paymentId: payment.id,
    paidAt: payment.paidAt
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "ALLOCATE_CREDITS",
    entityType: "AsaasPayment",
    entityId: payment.id,
    payload: { mode: "UNIVERSAL" }
  });

  return NextResponse.json({ ok: true, message: "Créditos aplicados no saldo geral." });
}
