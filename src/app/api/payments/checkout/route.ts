import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { paymentCheckoutSchema } from "@/lib/validators";
import { asaasFetch, normalizeDocument, isValidDocument } from "@/lib/asaas";
import { logAudit } from "@/lib/audit";
import { addPaymentCredits } from "@/lib/credits";

function formatValue(priceCents: number) {
  return Number((priceCents / 100).toFixed(2));
}

// "Hoje" no fuso do Brasil: em UTC, entre 21h e meia-noite (BRT) a data
// de toISOString() já seria a de amanhã.
function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function cancelOpenOneTimePayments(userId: string, packageId: string) {
  const openPayments = await prisma.asaasPayment.findMany({
    where: {
      userId,
      packageId,
      subscriptionId: null,
      status: { in: ["PENDING", "OVERDUE"] }
    },
    select: { id: true, asaasId: true }
  });

  for (const payment of openPayments) {
    await asaasFetch(`/payments/${payment.asaasId}`, {
      method: "DELETE"
    });
  }

  if (openPayments.length > 0) {
    await prisma.asaasPayment.updateMany({
      where: { id: { in: openPayments.map((payment) => payment.id) } },
      data: { status: "CANCELED" }
    });
  }

  return openPayments.length;
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO"]);
  if (response) return response;

  const body = await request.json();
  const parsed = paymentCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const packageRecord = await prisma.sessionPackage.findUnique({
    where: { id: parsed.data.packageId },
    include: { subject: true }
  });

  if (!packageRecord || !packageRecord.active) {
    return NextResponse.json({ message: "Pacote indisponível" }, { status: 400 });
  }

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!studentProfile?.document) {
    return NextResponse.json({ message: "Informe CPF/CNPJ antes do pagamento." }, { status: 400 });
  }

  // Valida o documento antes de enviar para o Asaas
  if (!isValidDocument(studentProfile.document)) {
    return NextResponse.json({ 
      message: "CPF/CNPJ inválido. Por favor, atualize seus dados antes de prosseguir." 
    }, { status: 400 });
  }

  const billingType = "PIX";

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

  // Todos os pacotes são compra única (PIX). O modelo de assinatura foi
  // descontinuado: mesmo que o registro do pacote ainda traga billingType
  // SUBSCRIPTION, a cobrança gerada aqui é sempre única. Assinaturas que já
  // existem no Asaas seguem seu curso até o aluno cancelar.
  const canceledOpenPaymentsCount = await cancelOpenOneTimePayments(session.user.id, packageRecord.id);

  const payment = await asaasFetch<{ id: string; status: string; invoiceUrl?: string; bankSlipUrl?: string; dueDate?: string; value: number; billingType: string }>(
    "/payments",
    {
      method: "POST",
      body: {
        customer: asaasCustomerId,
        billingType,
        value: formatValue(packageRecord.priceCents),
        dueDate: todayInSaoPaulo(),
        description: `${packageRecord.name} (${packageRecord.subject?.name ?? "Disciplina"})`,
        externalReference: `package:${packageRecord.id}:user:${session.user.id}`
      }
    }
  );

  const paymentStatus =
    payment.status === "RECEIVED" || payment.status === "CONFIRMED" ? "CONFIRMED" : "PENDING";

  const createdPayment = await prisma.asaasPayment.create({
    data: {
      userId: session.user.id,
      packageId: packageRecord.id,
      asaasId: payment.id,
      status: paymentStatus,
      amountCents: Math.round(payment.value * 100),
      billingType: payment.billingType,
      dueDate: payment.dueDate ? new Date(payment.dueDate) : null,
      payload: payment as unknown as Prisma.InputJsonValue
    }
  });

  // Se o Asaas já confirmou na criação, credita agora (idempotente com o
  // webhook): sem isso, o aluno pagou e o crédito dependeria só do webhook.
  // Pacote genérico fica para o fluxo de alocação de disciplina.
  if (paymentStatus === "CONFIRMED" && packageRecord.subjectId) {
    await addPaymentCredits({
      studentId: session.user.id,
      subjectId: packageRecord.subjectId,
      amount: packageRecord.sessionCount,
      paymentId: createdPayment.id,
      paidAt: new Date()
    });
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "CREATE_PAYMENT",
    entityType: "AsaasPayment",
    entityId: createdPayment.id,
    payload: { packageId: packageRecord.id, canceledOpenPaymentsCount }
  });

  return NextResponse.json({
    paymentId: createdPayment.id,
    paymentUrl: payment.invoiceUrl ?? payment.bankSlipUrl ?? null
  });
}
