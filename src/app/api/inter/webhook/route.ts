import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addPaymentCredits } from "@/lib/credits";

function shouldAuthorize(request: Request) {
  const token = process.env.INTER_WEBHOOK_TOKEN;
  if (!token) return true;
  const provided = request.headers.get("x-inter-webhook-token");
  return provided === token;
}

export async function POST(request: Request) {
  if (!shouldAuthorize(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    pix?: Array<{
      txid?: string;
      valor?: string;
      horario?: string;
    }>;
  } | null;

  if (!payload?.pix?.length) {
    return NextResponse.json({ ok: true });
  }

  for (const pix of payload.pix) {
    if (!pix?.txid) continue;

    const payment = (await prisma.asaasPayment.findUnique({
      where: { asaasId: pix.txid },
      include: { package: true }
    })) as Prisma.AsaasPaymentGetPayload<{ include: { package: true } }> | null;

    if (!payment) continue;

    const updated = await prisma.asaasPayment.update({
      where: { id: payment.id },
      data: {
        status: "CONFIRMED",
        paidAt: pix.horario ? new Date(pix.horario) : payment.paidAt,
        payload: payload as unknown as Prisma.InputJsonValue
      },
      include: { package: true }
    });

    const alreadyCredited = await prisma.studentCreditLedger.findFirst({
      where: { paymentId: updated.id, reason: "PAYMENT_CREDIT" }
    });

    if (!alreadyCredited && updated.package.subjectId) {
      await addPaymentCredits({
        studentId: updated.userId,
        subjectId: updated.package.subjectId,
        amount: updated.package.sessionCount,
        paymentId: updated.id,
        paidAt: updated.paidAt
      });
    }
  }

  return NextResponse.json({ ok: true });
}
