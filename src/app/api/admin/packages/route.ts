import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { packageSchema, packageUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

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

  const created = await prisma.sessionPackage.create({
    data: {
      name: parsed.data.name,
      sessionCount: parsed.data.sessionCount,
      priceCents: parsed.data.priceCents,
      active: parsed.data.active ?? true,
      billingType: parsed.data.billingType ?? "PACKAGE",
      billingCycle: parsed.data.billingType === "SUBSCRIPTION" ? parsed.data.billingCycle ?? "MONTHLY" : null,
      subjectId: parsed.data.subjectId ?? null
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

  const updated = await prisma.sessionPackage.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      sessionCount: parsed.data.sessionCount,
      priceCents: parsed.data.priceCents,
      active: parsed.data.active,
      billingType: parsed.data.billingType,
      billingCycle: parsed.data.billingType === "SUBSCRIPTION" ? parsed.data.billingCycle ?? "MONTHLY" : null,
      subjectId: parsed.data.subjectId ?? null
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

  await prisma.sessionPackage.delete({ where: { id } });

  await logAudit({
    actorUserId: session.user.id,
    action: "DELETE_PACKAGE",
    entityType: "SessionPackage",
    entityId: id,
    payload: { id }
  });

  return NextResponse.json({ ok: true });
}
