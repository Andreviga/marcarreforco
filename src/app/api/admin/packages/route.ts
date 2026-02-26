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

  if (activeSubscriptions > 0 || activePayments > 0) {
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
        }
      },
      { status: 409 }
    );
  }

  const removedPackageId = await getOrCreateRemovedPackageId();

  await prisma.$transaction([
    prisma.asaasPayment.updateMany({
      where: { packageId: id, status: "CANCELED" },
      data: { packageId: removedPackageId }
    }),
    prisma.asaasSubscription.updateMany({
      where: { packageId: id, status: "CANCELED" },
      data: { packageId: removedPackageId }
    }),
    prisma.sessionPackage.delete({ where: { id } })
  ]);

  await logAudit({
    actorUserId: session.user.id,
    action: "DELETE_PACKAGE",
    entityType: "SessionPackage",
    entityId: id,
    payload: { id, migratedCanceledLinksTo: removedPackageId }
  });

  return NextResponse.json({ ok: true, migratedCanceledLinksTo: removedPackageId });
}
