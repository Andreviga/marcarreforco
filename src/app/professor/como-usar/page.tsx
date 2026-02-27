import { requireRole } from "@/lib/rbac";
import AppShell from "@/components/AppShell";

const steps = [
  {
    title: "1) Confira sua agenda",
    text: "Abra Sessões para ver os horários do dia, status e disciplina de cada aula."
  },
  {
    title: "2) Abra a sessão e registre presença",
    text: "Ao finalizar a aula, marque presença/ausência para manter os créditos e relatórios corretos."
  },
  {
    title: "3) Responda a Central de Dúvidas",
    text: "Acesse Dúvidas para responder alunos, pedir mais contexto e acompanhar o histórico da conversa."
  },
  {
    title: "4) Mantenha seu perfil atualizado",
    text: "Em Perfil, confirme seus dados e disciplinas para evitar problemas de alocação."
  }
];

export default async function ProfessorComoUsarPage() {
  await requireRole(["PROFESSOR"]);

  return (
    <AppShell title="Como usar a plataforma" subtitle="Roteiro rápido para professores" role="PROFESSOR">
      <div className="space-y-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Roteiro de uso</h2>
          <p className="mt-1 text-sm text-slate-600">
            Siga esta ordem para usar a plataforma no dia a dia sem perder prazos ou informações importantes.
          </p>
        </div>

        <div className="grid gap-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
