import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function logAudit({
  actorUserId,
  action,
  entityType,
  entityId,
  payload
}: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      entityType,
      entityId,
      payloadJson: payload as Prisma.InputJsonValue
    }
  });
}
