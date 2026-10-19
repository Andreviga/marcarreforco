import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { studentDisplayName } from "@/lib/student-name";
import AppShell from "@/components/AppShell";
import AdminPaymentsClient from "@/components/AdminPaymentsClient";


// Cobranças pertencem à conta do responsável; o admin identifica pelo nome do
// aluno, mantendo o responsável como informação secundária (e pesquisável).
function toUserInfo(user: {
  id: string;
  name: string;
  email: string;
  studentProfile?: { studentName?: string | null } | null;
}) {
  const displayName = studentDisplayName(user);
  return {
    id: user.id,
    name: displayName,
    email: user.email,
    guardianName: displayName !== user.name ? user.name : null
  };
}

export default async function AdminPagamentosPage() {
  await requireRole(["ADMIN"]);

  const [payments, subscriptions, auditLogs] = await Promise.all([
    prisma.asaasPayment.findMany({
      include: { user: { select: { id: true, name: true, email: true, studentProfile: { select: { studentName: true } } } }, package: { include: { subject: true } } },
      orderBy: { createdAt: "desc" },
      take: 500
    }),
    prisma.asaasSubscription.findMany({
      include: { user: { select: { id: true, name: true, email: true, studentProfile: { select: { studentName: true } } } }, package: { include: { subject: true } } },
      orderBy: { createdAt: "desc" },
      take: 500
    }),
    prisma.auditLog.findMany({
      where: {
        entityType: "AsaasSubscription"
      },
      include: { actor: { select: { id: true, name: true, email: true, studentProfile: { select: { studentName: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 500
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
    user: toUserInfo(p.user),
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
    user: toUserInfo(s.user),
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
    actor: toUserInfo(l.actor)
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
