import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addCredits } from "@/lib/credits";

const paymentStatusMap: Record<string, "PENDING" | "CONFIRMED" | "OVERDUE" | "CANCELED" | "REFUNDED"> = {
  PENDING: "PENDING",
  RECEIVED: "CONFIRMED",
  CONFIRMED: "CONFIRMED",
  OVERDUE: "OVERDUE",
  CANCELED: "CANCELED",
  REFUNDED: "REFUNDED"
};

const subscriptionStatusMap: Record<string, "ACTIVE" | "INACTIVE" | "CANCELED" | "OVERDUE"> = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  CANCELED: "CANCELED",
  OVERDUE: "OVERDUE"
};

function parseExternalReference(value?: string | null) {
  if (!value) return null;
  const match = /package:(.+?):user:(.+)/.exec(value);
  if (!match) return null;
  return { packageId: match[1], userId: match[2] };
}

export async function POST(request: Request) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  const provided = request.headers.get("asaas-access-token");
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
    const status = paymentStatusMap[paymentData.status ?? "PENDING"] ?? "PENDING";

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
        await addCredits({
          studentId: payment.userId,
          subjectId: payment.package.subjectId,
          delta: payment.package.sessionCount,
          reason: "PAYMENT_CREDIT",
          paymentId: payment.id
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
        await addCredits({
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
    const status = subscriptionStatusMap[payload.subscription.status ?? "INACTIVE"] ?? "INACTIVE";
    await prisma.asaasSubscription.updateMany({
      where: { asaasId: payload.subscription.id },
      data: {
        status,
        nextDueDate: payload.subscription.nextDueDate ? new Date(payload.subscription.nextDueDate) : null
      }
    });
  }

  return NextResponse.json({ ok: true });
}
