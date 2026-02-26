import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { asaasFetch } from "@/lib/asaas";
import { logAudit } from "@/lib/audit";

const OPEN_PAYMENT_STATUSES = new Set(["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"]);

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const payment = await prisma.asaasPayment.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true } },
      package: { select: { name: true } }
    }
  });

  if (!payment) {
    return NextResponse.json({ message: "Pagamento não encontrado." }, { status: 404 });
  }

  if (payment.status === "CANCELED") {
    return NextResponse.json({ message: "Pagamento já está cancelado." }, { status: 400 });
  }

  if (!OPEN_PAYMENT_STATUSES.has(payment.status)) {
    return NextResponse.json(
      { message: `Pagamento com status ${payment.status} não pode ser cancelado pelo admin.` },
      { status: 400 }
    );
  }

  try {
    await asaasFetch(`/payments/${payment.asaasId}`, { method: "DELETE" });

    const updated = await prisma.asaasPayment.update({
      where: { id: payment.id },
      data: { status: "CANCELED" }
    });

    await logAudit({
      actorUserId: session.user.id,
      action: "ADMIN_CANCEL_PAYMENT",
      entityType: "AsaasPayment",
      entityId: payment.id,
      payload: {
        paymentId: payment.id,
        asaasId: payment.asaasId,
        previousStatus: payment.status,
        package: payment.package.name,
        user: payment.user.name
      }
    });

    return NextResponse.json({ message: "Pagamento cancelado com sucesso.", payment: updated });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ message: "Erro ao cancelar pagamento no Asaas.", detail }, { status: 500 });
  }
}
