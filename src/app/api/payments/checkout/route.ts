import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { paymentCheckoutSchema } from "@/lib/validators";
import { asaasFetch, normalizeDocument } from "@/lib/asaas";
import { logAudit } from "@/lib/audit";

function formatValue(priceCents: number) {
  return Number((priceCents / 100).toFixed(2));
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO"]);
  if (response) return response;

  const body = await request.json();
  const parsed = paymentCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const billingType = parsed.data.billingType ?? "PIX";

  const packageRecord = await prisma.sessionPackage.findUnique({
    where: { id: parsed.data.packageId },
    include: { subject: true }
  });

  if (!packageRecord || !packageRecord.active || !packageRecord.subjectId) {
    return NextResponse.json({ message: "Pacote indisponível" }, { status: 400 });
  }

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!studentProfile?.document) {
    return NextResponse.json({ message: "Informe CPF/CNPJ antes do pagamento." }, { status: 400 });
  }

  const customer = await prisma.asaasCustomer.findUnique({
    where: { userId: session.user.id }
  });

  let asaasCustomerId = customer?.asaasId ?? null;

  if (!asaasCustomerId) {
    const newCustomer = await asaasFetch<{ id: string }>("/customers", {
      method: "POST",
      body: {
        name: session.user.name,
        email: session.user.email,
        cpfCnpj: normalizeDocument(studentProfile.document),
        externalReference: session.user.id
      }
    });

    const created = await prisma.asaasCustomer.create({
      data: { userId: session.user.id, asaasId: newCustomer.id }
    });

    asaasCustomerId = created.asaasId;
  }

  if (packageRecord.billingType === "SUBSCRIPTION") {
    const existing = await prisma.asaasSubscription.findFirst({
      where: {
        userId: session.user.id,
        packageId: packageRecord.id,
        status: "ACTIVE"
      }
    });

    if (existing) {
      return NextResponse.json({ message: "Assinatura já ativa." }, { status: 400 });
    }

    const subscription = await asaasFetch<{ id: string; status: string; nextDueDate?: string }>("/subscriptions", {
      method: "POST",
      body: {
        customer: asaasCustomerId,
        billingType,
        value: formatValue(packageRecord.priceCents),
        nextDueDate: new Date().toISOString().split("T")[0],
        cycle: packageRecord.billingCycle ?? "MONTHLY",
        description: `${packageRecord.name} (${packageRecord.subject?.name ?? "Disciplina"})`,
        externalReference: `package:${packageRecord.id}:user:${session.user.id}`
      }
    });

    const createdSubscription = await prisma.asaasSubscription.create({
      data: {
        userId: session.user.id,
        packageId: packageRecord.id,
        asaasId: subscription.id,
        status: subscription.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        nextDueDate: subscription.nextDueDate ? new Date(subscription.nextDueDate) : null
      }
    });

    const paymentList = await asaasFetch<{ data: Array<{ id: string; invoiceUrl?: string; bankSlipUrl?: string; status: string; dueDate?: string; value: number; billingType: string }> }>(
      `/payments?subscription=${subscription.id}&limit=1`,
      { method: "GET" }
    );

    const payment = paymentList.data?.[0];
    if (payment) {
      await prisma.asaasPayment.create({
        data: {
          userId: session.user.id,
          packageId: packageRecord.id,
          subscriptionId: createdSubscription.id,
          asaasId: payment.id,
          status: payment.status === "RECEIVED" || payment.status === "CONFIRMED" ? "CONFIRMED" : "PENDING",
          amountCents: Math.round(payment.value * 100),
          billingType: payment.billingType,
          dueDate: payment.dueDate ? new Date(payment.dueDate) : null,
          payload: payment as unknown as Record<string, unknown>
        }
      });
    }

    await logAudit({
      actorUserId: session.user.id,
      action: "CREATE_SUBSCRIPTION",
      entityType: "AsaasSubscription",
      entityId: createdSubscription.id,
      payload: { packageId: packageRecord.id }
    });

    return NextResponse.json({
      subscriptionId: createdSubscription.id,
      paymentUrl: payment?.invoiceUrl ?? payment?.bankSlipUrl ?? null
    });
  }

  const payment = await asaasFetch<{ id: string; status: string; invoiceUrl?: string; bankSlipUrl?: string; dueDate?: string; value: number; billingType: string }>(
    "/payments",
    {
      method: "POST",
      body: {
        customer: asaasCustomerId,
        billingType,
        value: formatValue(packageRecord.priceCents),
        dueDate: new Date().toISOString().split("T")[0],
        description: `${packageRecord.name} (${packageRecord.subject?.name ?? "Disciplina"})`,
        externalReference: `package:${packageRecord.id}:user:${session.user.id}`
      }
    }
  );

  const createdPayment = await prisma.asaasPayment.create({
    data: {
      userId: session.user.id,
      packageId: packageRecord.id,
      asaasId: payment.id,
      status: payment.status === "RECEIVED" || payment.status === "CONFIRMED" ? "CONFIRMED" : "PENDING",
      amountCents: Math.round(payment.value * 100),
      billingType: payment.billingType,
      dueDate: payment.dueDate ? new Date(payment.dueDate) : null,
      payload: payment as unknown as Record<string, unknown>
    }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "CREATE_PAYMENT",
    entityType: "AsaasPayment",
    entityId: createdPayment.id,
    payload: { packageId: packageRecord.id }
  });

  return NextResponse.json({
    paymentId: createdPayment.id,
    paymentUrl: payment.invoiceUrl ?? payment.bankSlipUrl ?? null
  });
}
