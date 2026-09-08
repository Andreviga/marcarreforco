import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const SENSITIVE_KEYS = new Set(["password", "newpassword", "currentpassword", "passwordhash", "senha"]);

// O payload nunca pode carregar credenciais: o AuditLog fica no banco e em
// backups, e uma senha em claro ali anula o bcrypt.
function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redactSensitive(val)
      ])
    );
  }
  return value;
}

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
      payloadJson: redactSensitive(payload) as Prisma.InputJsonValue
    }
  });
}
