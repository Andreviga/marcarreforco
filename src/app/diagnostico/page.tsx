"use client";

import { useSession } from "next-auth/react";

export default function DiagnosticoPage() {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Diagnóstico de Acesso</h1>
        
        <div className="mt-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">Status da Sessão:</p>
            <p className="text-lg text-slate-900">{status}</p>
          </div>

          {session?.user && (
            <>
              <div>
                <p className="text-sm font-semibold text-slate-700">Email:</p>
                <p className="text-lg text-slate-900">{session.user.email}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">Nome:</p>
                <p className="text-lg text-slate-900">{session.user.name}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">Role (Permissão):</p>
                <p className="text-2xl font-bold text-slate-900">{session.user.role}</p>
              </div>

              <div className="mt-6 rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Acessos Permitidos:</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {session.user.role === "ADMIN" && (
                    <>
                      <li>✅ /admin/sessoes</li>
                      <li>✅ /admin/usuarios</li>
                      <li>✅ /admin/disciplinas</li>
                      <li>✅ /admin/pacotes</li>
                      <li>✅ /admin/pagamentos</li>
                      <li>✅ /admin/tickets</li>
                    </>
                  )}
                  {session.user.role === "PROFESSOR" && (
                    <>
                      <li>✅ /professor/sessoes</li>
                      <li>✅ /professor/tickets</li>
                    </>
                  )}
                  {session.user.role === "ALUNO" && (
                    <>
                      <li>✅ /aluno/agenda</li>
                      <li>✅ /aluno/minhas-inscricoes</li>
                      <li>✅ /aluno/pagamentos</li>
                      <li>✅ /aluno/tickets</li>
                    </>
                  )}
                </ul>
              </div>

              {session.user.role === "ADMIN" && (
                <div className="mt-4">
                  <a
                    href="/admin/pacotes"
                    className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                  >
                    Testar Acesso a Pacotes
                  </a>
                </div>
              )}
            </>
          )}

          {!session && status !== "loading" && (
            <div className="rounded-lg bg-red-50 p-4 text-red-700">
              Você não está autenticado. <a href="/login" className="underline">Fazer login</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
