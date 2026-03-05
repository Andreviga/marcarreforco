import { requireRole } from "@/lib/rbac";
import AppShell from "@/components/AppShell";
import AdminCleanupClient from "@/components/AdminCleanupClient";

export default async function AdminLimpezaPage() {
  await requireRole(["ADMIN"]);

  return (
    <AppShell title="Limpeza de dados" subtitle="Guia e ações para remover dados antigos/de teste" role="ADMIN">
      <div className="space-y-6">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Caminho para excluir professores e disciplinas</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>
              Acesse <strong>Admin → Sessões</strong> e remova/cancele sessões antigas vinculadas ao professor/disciplina.
            </li>
            <li>
              Acesse <strong>Admin → Pacotes</strong> e remova pacotes antigos vinculados à disciplina.
            </li>
            <li>
              Depois, vá em <strong>Admin → Usuários</strong> (professor) ou <strong>Admin → Disciplinas</strong> e exclua o cadastro.
            </li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            Se ainda houver vínculo (mensagem de bloqueio), use as ações automáticas abaixo para limpar itens antigos/de teste.
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Limpeza automática</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use estas ações para remover registros antigos e de teste que atrapalham exclusões.
          </p>
          <div className="mt-4">
            <AdminCleanupClient />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
