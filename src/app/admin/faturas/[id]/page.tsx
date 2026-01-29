import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import InvoiceDetailClient from "@/components/InvoiceDetailClient";

export default async function AdminFaturaDetailPage({ params }: { params: { id: string } }) {
  await requireRole(["ADMIN"]);

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { student: true, items: { include: { session: { include: { subject: true, teacher: true } }, attendance: true } } }
  });

  if (!invoice) {
    return (
      <AppShell title="Fatura" role="ADMIN">
        <p className="text-sm text-slate-500">Fatura não encontrada.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Fatura ${invoice.student.name}`} subtitle={`${invoice.month}/${invoice.year}`} role="ADMIN">
      <InvoiceDetailClient invoice={invoice} />
    </AppShell>
  );
}
