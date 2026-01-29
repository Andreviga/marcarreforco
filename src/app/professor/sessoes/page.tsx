import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import Link from "next/link";
import { addDays, startOfDay } from "date-fns";

export default async function ProfessorSessoesPage() {
  const session = await requireRole(["PROFESSOR"]);

  const now = startOfDay(new Date());
  const end = addDays(now, 7);

  const sessions = await prisma.session.findMany({
    where: {
      teacherId: session.user.id,
      startsAt: { gte: now, lte: end }
    },
    include: { subject: true },
    orderBy: { startsAt: "asc" }
  });

  return (
    <AppShell title="Sessões da semana" subtitle="Sua agenda de reforços" role="PROFESSOR">
      <div className="grid gap-4">
        {sessions.map((item) => (
          <Link
            key={item.id}
            href={`/professor/sessoes/${item.id}`}
            className="rounded-xl bg-white p-4 shadow-sm hover:bg-slate-50"
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-slate-900">{item.subject.name}</h3>
              <p className="text-sm text-slate-500">
                {new Date(item.startsAt).toLocaleString("pt-BR")} - {new Date(item.endsAt).toLocaleTimeString("pt-BR")}
              </p>
              <p className="text-xs text-slate-400">Status: {item.status}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
