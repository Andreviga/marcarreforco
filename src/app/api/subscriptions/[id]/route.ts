import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { asaasFetch } from "@/lib/asaas";
import { logAudit } from "@/lib/audit";

type AsaasPaymentListResponse = {
  data?: Array<{
    id: string;
    status?: string;
  }>;
};

const OPEN_PAYMENT_STATUSES = new Set(["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"]);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido";
}

// DELETE /api/subscriptions/[id] - Cancelar assinatura
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireApiRole(["ALUNO", "ADMIN"]);
  if (response) return response;

  const subscriptionId = params.id;

  // Buscar assinatura no banco
  const subscription = await prisma.asaasSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      package: {
        select: {
          name: true,
          id: true
        }
      }
    }
  });

  if (!subscription) {
    return NextResponse.json({ message: "Assinatura não encontrada" }, { status: 404 });
  }

  // Verificar se o usuário é dono da assinatura ou é admin
  if (subscription.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Sem permissão para cancelar esta assinatura" }, { status: 403 });
  }

  // Verificar se já está cancelada
  if (subscription.status === "CANCELED") {
    return NextResponse.json({ message: "Assinatura já está cancelada" }, { status: 400 });
  }

  try {
    let canceledPaymentsCount = 0;
    let hasOpenPayments = false;
    let asaasCancelWarning: string | null = null;

    // Sempre que cancelar assinatura, cancelar também cobranças ainda em aberto no Asaas.
    const payments = await asaasFetch<AsaasPaymentListResponse>(
      `/payments?subscription=${subscription.asaasId}&limit=100`,
      { method: "GET" }
    );

    const openPaymentIds = (payments.data ?? [])
      .filter((payment) => OPEN_PAYMENT_STATUSES.has(payment.status ?? ""))
      .map((payment) => payment.id);

    hasOpenPayments = openPaymentIds.length > 0;

    for (const paymentId of openPaymentIds) {
      await asaasFetch(`/payments/${paymentId}`, {
        method: "DELETE"
      });
    }

    if (openPaymentIds.length > 0) {
      canceledPaymentsCount = openPaymentIds.length;

      await prisma.asaasPayment.updateMany({
        where: {
          asaasId: { in: openPaymentIds }
        },
        data: {
          status: "CANCELED"
        }
      });
    }

    // Cancelar assinatura no Asaas
    try {
      await asaasFetch(`/subscriptions/${subscription.asaasId}`, {
        method: "DELETE"
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      if (!hasOpenPayments) {
        asaasCancelWarning =
          "Assinatura marcada como cancelada no sistema. O Asaas retornou erro ao encerrar o registro remoto, mas não há cobranças pendentes para esta assinatura.";
      } else {
        throw new Error(errorMessage);
      }
    }

    // Atualizar status no banco
    const updated = await prisma.asaasSubscription.update({
      where: { id: subscriptionId },
      data: { status: "CANCELED" }
    });

    // Registrar no audit log
    await logAudit({
      actorUserId: session.user.id,
      action: "CANCEL_SUBSCRIPTION",
      entityType: "AsaasSubscription",
      entityId: subscriptionId,
      payload: {
        subscriptionId,
        packageId: subscription.packageId,
        packageName: subscription.package.name,
        asaasId: subscription.asaasId
      }
    });

    return NextResponse.json({ 
      message:
        asaasCancelWarning ??
        (canceledPaymentsCount > 0
          ? `Assinatura cancelada com sucesso. ${canceledPaymentsCount} cobrança(s) pendente(s) também foram canceladas no Asaas.`
          : "Assinatura cancelada com sucesso"),
      subscription: updated,
      canceledPaymentsCount,
      asaasCancelWarning
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    console.error("CANCEL_SUBSCRIPTION_ERROR", {
      subscriptionId,
      asaasId: subscription.asaasId,
      error: errorMessage
    });
    
    return NextResponse.json({ 
      message: "Erro ao cancelar assinatura. Tente novamente.",
      detail: errorMessage
    }, { status: 500 });
  }
}
