import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { paymentCheckoutSchema } from "@/lib/validators";
import { createPixCob } from "@/lib/inter";
import { logAudit } from "@/lib/audit";

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

  if (packageRecord.billingType === "SUBSCRIPTION") {
    return NextResponse.json({ message: "Assinaturas desativadas. Use pacotes avulsos." }, { status: 400 });
  }

  const cob = await createPixCob({
    amountCents: packageRecord.priceCents,
    payerName: session.user.name ?? "Aluno",
    payerDocument: studentProfile.document,
    description: `${packageRecord.name} (${packageRecord.subject?.name ?? "Disciplina"})`
  });

  const createdPayment = await prisma.asaasPayment.create({
    data: {
      userId: session.user.id,
      packageId: packageRecord.id,
      asaasId: cob.txid,
      status: "PENDING",
      amountCents: packageRecord.priceCents,
      billingType: "PIX",
      dueDate: new Date(Date.now() + cob.expiresIn * 1000),
      payload: cob as unknown as Prisma.InputJsonValue
    }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "CREATE_PAYMENT",
    entityType: "InterPayment",
    entityId: createdPayment.id,
    payload: { packageId: packageRecord.id }
  });

  return NextResponse.json({
    paymentId: createdPayment.id,
    pixCopyPaste: cob.pixCopyPaste,
    qrCodeImage: cob.qrCodeImage
  });
}
