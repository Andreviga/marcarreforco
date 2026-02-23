import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { asaasFetch } from "@/lib/asaas";
import { logAudit } from "@/lib/audit";

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
  if (subscription.status === "INACTIVE") {
    return NextResponse.json({ message: "Assinatura já está cancelada" }, { status: 400 });
  }

  try {
    // Cancelar assinatura no Asaas
    await asaasFetch(`/subscriptions/${subscription.asaasId}`, {
      method: "DELETE"
    });

    // Atualizar status no banco
    const updated = await prisma.asaasSubscription.update({
      where: { id: subscriptionId },
      data: { status: "INACTIVE" }
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
      message: "Assinatura cancelada com sucesso",
      subscription: updated
    });
  } catch (error) {
    console.error("CANCEL_SUBSCRIPTION_ERROR", {
      subscriptionId,
      asaasId: subscription.asaasId,
      error: error instanceof Error ? error.message : error
    });
    
    return NextResponse.json({ 
      message: "Erro ao cancelar assinatura. Tente novamente." 
    }, { status: 500 });
  }
}
