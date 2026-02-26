import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { packageSchema, packageUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

function normalizePackageName(name: string) {
  return name.replace(/\s*\(sem disciplina\)\s*/gi, " ").replace(/\s{2,}/g, " ").trim();
}

const REMOVED_PACKAGE_NAME = "PACOTE REMOVIDO (HISTÓRICO)";
const OPEN_PAYMENT_STATUSES: Array<"PENDING" | "OVERDUE"> = ["PENDING", "OVERDUE"];

async function getOrCreateRemovedPackageId() {
  const existing = await prisma.sessionPackage.findUnique({
    where: { name: REMOVED_PACKAGE_NAME },
    select: { id: true }
  });
  if (existing) return existing.id;

  const created = await prisma.sessionPackage.create({
    data: {
      name: REMOVED_PACKAGE_NAME,
      sessionCount: 1,
      priceCents: 0,
      active: false,
      billingType: "PACKAGE",
      billingCycle: null,
      subjectId: null
    },
    select: { id: true }
  });

  return created.id;
}

export async function GET() {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const packages = await prisma.sessionPackage.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ packages });
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = packageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  if (parsed.data.billingType === "SUBSCRIPTION" && !parsed.data.billingCycle) {
    return NextResponse.json({ message: "Ciclo obrigatório para assinaturas" }, { status: 400 });
  }

  const sessionCount = parsed.data.sessionCount ?? 0;
  const requiresGeneralSubject =
    parsed.data.billingType === "SUBSCRIPTION" &&
    ((parsed.data.billingCycle === "WEEKLY" && sessionCount > 1) ||
      (parsed.data.billingCycle === "MONTHLY" && sessionCount > 4));

  const created = await prisma.sessionPackage.create({
    data: {
      name: normalizePackageName(parsed.data.name),
      sessionCount: parsed.data.sessionCount,
      priceCents: parsed.data.priceCents,
      active: parsed.data.active ?? true,
      billingType: parsed.data.billingType ?? "PACKAGE",
      billingCycle: parsed.data.billingType === "SUBSCRIPTION" ? parsed.data.billingCycle ?? "MONTHLY" : null,
      subjectId: requiresGeneralSubject ? null : parsed.data.subjectId ?? null
    }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "CREATE_PACKAGE",
    entityType: "SessionPackage",
    entityId: created.id,
    payload: parsed.data
  });

  return NextResponse.json({ package: created });
}

export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = packageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  if (parsed.data.billingType === "SUBSCRIPTION" && !parsed.data.billingCycle) {
    return NextResponse.json({ message: "Ciclo obrigatório para assinaturas" }, { status: 400 });
  }

  const sessionCount = parsed.data.sessionCount ?? 0;
  const requiresGeneralSubject =
    parsed.data.billingType === "SUBSCRIPTION" &&
    ((parsed.data.billingCycle === "WEEKLY" && sessionCount > 1) ||
      (parsed.data.billingCycle === "MONTHLY" && sessionCount > 4));

  const updated = await prisma.sessionPackage.update({
    where: { id: parsed.data.id },
    data: {
      name: typeof parsed.data.name === "string" ? normalizePackageName(parsed.data.name) : undefined,
      sessionCount: parsed.data.sessionCount,
      priceCents: parsed.data.priceCents,
      active: parsed.data.active,
      billingType: parsed.data.billingType,
      billingCycle: parsed.data.billingType === "SUBSCRIPTION" ? parsed.data.billingCycle ?? "MONTHLY" : null,
      subjectId: requiresGeneralSubject ? null : parsed.data.subjectId ?? null
    }
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "UPDATE_PACKAGE",
    entityType: "SessionPackage",
    entityId: updated.id,
    payload: parsed.data
  });

  return NextResponse.json({ package: updated });
}

export async function DELETE(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const forceDelete = searchParams.get("force") === "1";
  if (!id) {
    return NextResponse.json({ message: "ID obrigatório" }, { status: 400 });
  }

  const packageData = await prisma.sessionPackage.findUnique({
    where: { id },
    select: { name: true, _count: { select: { subscriptions: true, payments: true } } }
  });

  if (!packageData) {
    return NextResponse.json({ message: "Pacote não encontrado." }, { status: 404 });
  }

  const [activeSubscriptions, activePayments] = await Promise.all([
    prisma.asaasSubscription.count({ where: { packageId: id, status: { not: "CANCELED" } } }),
    prisma.asaasPayment.count({ where: { packageId: id, status: { in: OPEN_PAYMENT_STATUSES } } })
  ]);

  if (!forceDelete && (activeSubscriptions > 0 || activePayments > 0)) {
    const [blockingSubscriptions, blockingPayments] = await Promise.all([
      prisma.asaasSubscription.findMany({
        where: { packageId: id, status: { not: "CANCELED" } },
        select: {
          id: true,
          status: true,
          asaasId: true,
          user: { select: { name: true, email: true } },
          nextDueDate: true
        },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      prisma.asaasPayment.findMany({
        where: { packageId: id, status: { in: OPEN_PAYMENT_STATUSES } },
        select: {
          id: true,
          status: true,
          asaasId: true,
          dueDate: true,
          user: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 20
      })
    ]);

    return NextResponse.json(
      {
        message:
          "Não foi possível excluir o pacote porque ele possui vínculos ativos. Cancele primeiro as assinaturas/pagamentos em aberto.",
        package: packageData.name,
        links: {
          subscriptions: packageData._count.subscriptions,
          payments: packageData._count.payments,
          activeSubscriptions,
          activePayments
        },
        blockingSubscriptions,
        blockingPayments
      },
      { status: 409 }
    );
  }

  const removedPackageId = await getOrCreateRemovedPackageId();

  const [migratedPayments, migratedSubscriptions] = await prisma.$transaction(async (tx) => {
    const paymentResult = await tx.asaasPayment.updateMany({
      where: { packageId: id },
      data: {
        packageId: removedPackageId,
        ...(forceDelete ? { status: "CANCELED" as const } : {})
      }
    });
    const subscriptionResult = await tx.asaasSubscription.updateMany({
      where: { packageId: id },
      data: {
        packageId: removedPackageId,
        ...(forceDelete ? { status: "CANCELED" as const } : {})
      }
    });
    await tx.sessionPackage.delete({ where: { id } });

    return [paymentResult.count, subscriptionResult.count] as const;
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "DELETE_PACKAGE",
    entityType: "SessionPackage",
    entityId: id,
    payload: { id, forceDelete, migratedCanceledLinksTo: removedPackageId, migratedPayments, migratedSubscriptions }
  });

  return NextResponse.json({
    ok: true,
    forceDelete,
    migratedCanceledLinksTo: removedPackageId,
    migratedPayments,
    migratedSubscriptions
  });
}
