import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";

const ACTION_LABELS: Record<string, string> = {
  ENROLL: "Inscrição em aula",
  UNENROLL: "Desmarcação de aula",
  CREATE_PACKAGE: "Criação de pacote",
  UPDATE_PACKAGE: "Atualização de pacote",
  DELETE_PACKAGE: "Exclusão de pacote",
  ADMIN_CANCEL_PAYMENT: "Cancelamento de pagamento (admin)",
  CANCEL_SUBSCRIPTION: "Cancelamento de assinatura",
  CREATE_SUBJECT: "Criação de disciplina",
  UPDATE_SUBJECT: "Atualização de disciplina",
  DELETE_SUBJECT: "Exclusão de disciplina",
  CREATE_SESSION: "Criação de sessão",
  UPDATE_SESSION: "Atualização de sessão",
  DELETE_SESSION: "Exclusão de sessão",
  CREATE_USER: "Criação de usuário",
  UPDATE_USER: "Atualização de usuário",
  DELETE_USER: "Exclusão de usuário",
  ADMIN_CLEANUP: "Limpeza administrativa"
};

const ENTITY_LABELS: Record<string, string> = {
  Enrollment: "Inscrição",
  SessionPackage: "Pacote",
  Subject: "Disciplina",
  Session: "Sessão",
  User: "Usuário",
  AsaasPayment: "Pagamento",
  AsaasSubscription: "Assinatura",
  Maintenance: "Manutenção"
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  PROFESSOR: "Professor",
  ALUNO: "Aluno"
};

function prettifyToken(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? prettifyToken(action);
}

function entityLabel(entityType: string) {
  return ENTITY_LABELS[entityType] ?? entityType;
}

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function formatPayload(payload: unknown) {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "{}";
  }
}

export default async function AdminLogsPage() {
  await requireRole(["ADMIN"]);

  const [logs, summary] = await Promise.all([
    prisma.auditLog.findMany({
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
      take: 10
    })
  ]);

  return (
    <AppShell
      title="Logs de usuários"
      subtitle="Auditoria completa de ações para suporte e acompanhamento"
      role="ADMIN"
    >
      <div className="space-y-6">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Resumo rápido</h2>
          <p className="mt-1 text-sm text-slate-500">Total de eventos carregados: {logs.length}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {summary.length === 0 ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Sem ações registradas</span>
            ) : (
              summary.map((item) => (
                <span key={item.action} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {item.action}: {item._count.action}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Últimas ações de usuários</h2>
          <p className="mt-1 text-sm text-slate-500">
            Registros de quem fez, o que fez, em qual entidade e com qual payload.
          </p>

          <div className="mt-4 space-y-3">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum log de auditoria encontrado.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 font-semibold text-white">{actionLabel(log.action)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{entityLabel(log.entityType)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">ID: {log.entityId}</span>
                    <span className="text-slate-500">{log.createdAt.toLocaleString("pt-BR")}</span>
                  </div>

                  <p className="mt-2 text-sm text-slate-700">
                    Usuário: <strong>{log.actor.name}</strong> ({log.actor.email}) • Perfil: {roleLabel(log.actor.role)}
                  </p>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-slate-600">Ver detalhes do payload</summary>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-700">
                      {formatPayload(log.payloadJson)}
                    </pre>
                  </details>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
