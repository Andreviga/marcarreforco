import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { asaasFetch } from "@/lib/asaas";
import { logAudit } from "@/lib/audit";

const CANCELABLE_PAYMENT_STATUSES = new Set(["PENDING", "OVERDUE"]);

// DELETE /api/payments/[id] - Cancelar cobrança avulsa
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireApiRole(["ALUNO", "ADMIN"]);
  if (response) return response;

  const paymentId = params.id;

  const payment = await prisma.asaasPayment.findUnique({
    where: { id: paymentId },
    include: {
      package: {
        select: {
          id: true,
          name: true,
          billingType: true
        }
      }
    }
  });

  if (!payment) {
    return NextResponse.json({ message: "Cobrança não encontrada" }, { status: 404 });
  }

  if (payment.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Sem permissão para cancelar esta cobrança" }, { status: 403 });
  }

  if (payment.subscriptionId) {
    return NextResponse.json(
      { message: "Esta cobrança pertence a uma assinatura. Use o cancelamento de assinatura." },
      { status: 400 }
    );
  }

  if (payment.package.billingType !== "PACKAGE") {
    return NextResponse.json({ message: "Apenas compras avulsas podem ser canceladas aqui." }, { status: 400 });
  }

  if (!CANCELABLE_PAYMENT_STATUSES.has(payment.status)) {
    return NextResponse.json({ message: "Somente cobranças pendentes ou vencidas podem ser canceladas." }, { status: 400 });
  }

  await asaasFetch(`/payments/${payment.asaasId}`, {
    method: "DELETE"
  });

  const updatedPayment = await prisma.asaasPayment.update({
    where: { id: payment.id },
    data: { status: "CANCELED" }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "CANCEL_PAYMENT",
    entityType: "AsaasPayment",
    entityId: payment.id,
    payload: {
      paymentId: payment.id,
      packageId: payment.package.id,
      packageName: payment.package.name,
      asaasId: payment.asaasId
    }
  });

  return NextResponse.json({
    message: "Cobrança avulsa cancelada com sucesso.",
    payment: updatedPayment
  });
}
