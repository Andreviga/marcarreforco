import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AdminPaymentsClient from "@/components/AdminPaymentsClient";

export default async function AdminPagamentosPage() {
  await requireRole(["ADMIN"]);

  const [payments, subscriptions, auditLogs] = await Promise.all([
    prisma.asaasPayment.findMany({
      include: { user: { select: { id: true, name: true, email: true } }, package: { include: { subject: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.asaasSubscription.findMany({
      include: { user: { select: { id: true, name: true, email: true } }, package: { include: { subject: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.auditLog.findMany({
      where: {
        entityType: "AsaasSubscription"
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);

  const paymentsData = payments.map((p) => ({
    id: p.id,
    asaasId: p.asaasId,
    status: p.status,
    amountCents: p.amountCents,
    billingType: p.billingType,
    dueDate: p.dueDate ? p.dueDate.toISOString() : null,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    user: p.user,
    package: {
      id: p.package.id,
      name: p.package.name,
      subject: p.package.subject ? { name: p.package.subject.name } : null
    }
  }));

  const subscriptionsData = subscriptions.map((s) => ({
    id: s.id,
    asaasId: s.asaasId,
    status: s.status,
    nextDueDate: s.nextDueDate ? s.nextDueDate.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    user: s.user,
    package: {
      id: s.package.id,
      name: s.package.name,
      subject: s.package.subject ? { name: s.package.subject.name } : null
    }
  }));

  const auditLogsData = auditLogs.map((l) => ({
    id: l.id,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    payloadJson: l.payloadJson as Record<string, unknown>,
    createdAt: l.createdAt.toISOString(),
    actor: l.actor
  }));

  return (
    <AppShell title="Pagamentos" subtitle="Assinaturas, cobranças e log de auditoria" role="ADMIN">
      <AdminPaymentsClient
        payments={paymentsData}
        subscriptions={subscriptionsData}
        auditLogs={auditLogsData}
      />
    </AppShell>
  );
}
