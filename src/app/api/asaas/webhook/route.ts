import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addPaymentCredits, adjustCredits } from "@/lib/credits";

const paymentStatusMap: Record<string, "PENDING" | "CONFIRMED" | "OVERDUE" | "CANCELED" | "REFUNDED"> = {
  PENDING: "PENDING",
  AWAITING_RISK_ANALYSIS: "PENDING",
  RECEIVED: "CONFIRMED",
  CONFIRMED: "CONFIRMED",
  RECEIVED_IN_CASH: "CONFIRMED",
  OVERDUE: "OVERDUE",
  CANCELED: "CANCELED",
  DELETED: "CANCELED",
  REFUNDED: "REFUNDED",
  RECEIVED_IN_CASH_UNDONE: "REFUNDED"
};

const paymentEventStatusMap: Record<string, "PENDING" | "CONFIRMED" | "OVERDUE" | "CANCELED" | "REFUNDED"> = {
  PAYMENT_CREATED: "PENDING",
  PAYMENT_AWAITING_RISK_ANALYSIS: "PENDING",
  PAYMENT_AUTHORIZED: "PENDING",
  PAYMENT_RECEIVED: "CONFIRMED",
  PAYMENT_CONFIRMED: "CONFIRMED",
  PAYMENT_OVERDUE: "OVERDUE",
  PAYMENT_DELETED: "CANCELED",
  PAYMENT_REFUNDED: "REFUNDED",
  PAYMENT_RECEIVED_IN_CASH_UNDONE: "REFUNDED"
};

const subscriptionStatusMap: Record<string, "ACTIVE" | "INACTIVE" | "CANCELED" | "OVERDUE"> = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  CANCELED: "CANCELED",
  OVERDUE: "OVERDUE"
};

async function getSafeSubscriptionStatus(
  asaasSubscriptionId: string,
  asaasStatus: string | undefined
): Promise<"ACTIVE" | "INACTIVE" | "CANCELED" | "OVERDUE"> {
  const mappedStatus = subscriptionStatusMap[asaasStatus ?? "INACTIVE"] ?? "INACTIVE";

  // No Asaas, uma assinatura pode nascer como ACTIVE mesmo sem pagamento confirmado.
  // Para nossa regra de negócio, ACTIVE só é válido após pelo menos 1 pagamento CONFIRMED.
  if (mappedStatus !== "ACTIVE") {
    return mappedStatus;
  }

  const hasConfirmedPayment = await prisma.asaasPayment.findFirst({
    where: {
      subscription: { asaasId: asaasSubscriptionId },
      status: "CONFIRMED"
    },
    select: { id: true }
  });

  return hasConfirmedPayment ? "ACTIVE" : "INACTIVE";
}

function parseExternalReference(value?: string | null) {
  if (!value) return null;
  const match = /package:(.+?):user:(.+)/.exec(value);
  if (!match) return null;
  return { packageId: match[1], userId: match[2] };
}

export async function POST(request: Request) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN ?? process.env.ASAAS_WEBHOOK_ACCESS_TOKEN;
  const provided =
    request.headers.get("asaas-access-token") ??
    request.headers.get("Asaas-Access-Token") ??
    request.headers.get("access_token");
  if (token && provided !== token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    event?: string;
    payment?: {
      id: string;
      status?: string;
      subscription?: string;
      customer?: string;
      value?: number;
      billingType?: string;
      dueDate?: string;
      paymentDate?: string;
      externalReference?: string;
    };
    subscription?: {
      id: string;
      status?: string;
      nextDueDate?: string;
    };
  } | null;

  if (!payload?.event) {
    return NextResponse.json({ ok: true });
  }

  if (payload.payment?.id) {
    const paymentData = payload.payment;
    const status =
      paymentStatusMap[paymentData.status ?? ""] ??
      paymentEventStatusMap[payload.event ?? ""] ??
      "PENDING";

    let payment: Prisma.AsaasPaymentGetPayload<{ include: { package: true } }> | null =
      await prisma.asaasPayment.findUnique({
        where: { asaasId: paymentData.id },
        include: { package: true }
      });

    if (!payment) {
      let userId: string | null = null;
      let packageId: string | null = null;
      let subscriptionId: string | null = null;

      if (paymentData.subscription) {
        const subscription = await prisma.asaasSubscription.findUnique({
          where: { asaasId: paymentData.subscription }
        });
        if (subscription) {
          userId = subscription.userId;
          packageId = subscription.packageId;
          subscriptionId = subscription.id;
        }
      }

      if (!userId || !packageId) {
        const parsed = parseExternalReference(paymentData.externalReference);
        userId = parsed?.userId ?? null;
        packageId = parsed?.packageId ?? null;
      }

      if (userId && packageId) {
        payment = (await prisma.asaasPayment.create({
          data: {
            userId,
            packageId,
            subscriptionId,
            asaasId: paymentData.id,
            status,
            amountCents: Math.round((paymentData.value ?? 0) * 100),
            billingType: paymentData.billingType ?? "PIX",
            dueDate: paymentData.dueDate ? new Date(paymentData.dueDate) : null,
            paidAt: paymentData.paymentDate ? new Date(paymentData.paymentDate) : null,
            payload: paymentData as unknown as Prisma.InputJsonValue
          },
          include: { package: true }
        })) as Prisma.AsaasPaymentGetPayload<{ include: { package: true } }>;
      }
    } else {
      payment = (await prisma.asaasPayment.update({
        where: { id: payment.id },
        data: {
          status,
          dueDate: paymentData.dueDate ? new Date(paymentData.dueDate) : payment.dueDate,
          paidAt: paymentData.paymentDate ? new Date(paymentData.paymentDate) : payment.paidAt,
          payload: paymentData as unknown as Prisma.InputJsonValue
        },
        include: { package: true }
      })) as Prisma.AsaasPaymentGetPayload<{ include: { package: true } }>;
    }

    if (payment && status === "CONFIRMED") {
      const alreadyCredited = await prisma.studentCreditLedger.findFirst({
        where: { paymentId: payment.id, reason: "PAYMENT_CREDIT" }
      });

      if (!alreadyCredited && payment.package.subjectId) {
        await addPaymentCredits({
          studentId: payment.userId,
          subjectId: payment.package.subjectId,
          amount: payment.package.sessionCount,
          paymentId: payment.id,
          paidAt: payment.paidAt
        });
      }
    }

    if (payment && (status === "CANCELED" || status === "REFUNDED")) {
      const credited = await prisma.studentCreditLedger.findFirst({
        where: { paymentId: payment.id, reason: "PAYMENT_CREDIT" }
      });
      const reversed = await prisma.studentCreditLedger.findFirst({
        where: { paymentId: payment.id, reason: "ADMIN_ADJUST" }
      });

      if (credited && !reversed && payment.package.subjectId) {
        await adjustCredits({
          studentId: payment.userId,
          subjectId: payment.package.subjectId,
          delta: -payment.package.sessionCount,
          reason: "ADMIN_ADJUST",
          paymentId: payment.id
        });
      }
    }
  }

  if (payload.subscription?.id) {
    const status = await getSafeSubscriptionStatus(payload.subscription.id, payload.subscription.status);
    const where =
      status === "CANCELED"
        ? { asaasId: payload.subscription.id }
        : { asaasId: payload.subscription.id, status: { not: "CANCELED" as const } };

    await prisma.asaasSubscription.updateMany({
      where,
      data: {
        status,
        nextDueDate: payload.subscription.nextDueDate ? new Date(payload.subscription.nextDueDate) : null
      }
    });
  }

  // Ativar assinatura quando o primeiro pagamento for confirmado
  if (payload.payment?.subscription && payload.payment?.id) {
    const paymentStatus =
      paymentStatusMap[payload.payment.status ?? ""] ??
      paymentEventStatusMap[payload.event ?? ""] ??
      "PENDING";
    if (paymentStatus === "CONFIRMED") {
      await prisma.asaasSubscription.updateMany({
        where: {
          asaasId: payload.payment.subscription,
          status: { not: "CANCELED" }
        },
        data: { status: "ACTIVE" }
      });
    }
  }

  return NextResponse.json({ ok: true });
}
