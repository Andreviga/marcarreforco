"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import RulesBanner from "@/components/RulesBanner";

const seriesOptions = [
  "1º ano",
  "2º ano",
  "3º ano",
  "4º ano",
  "5º ano",
  "6º ano",
  "7º ano",
  "8º ano",
  "9º ano"
];

const turmaOptions = ["Manhã", "Tarde"];

const defaultUnidade = "Colégio Raízes";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [serie, setSerie] = useState("");
  const [turma, setTurma] = useState("");
  const [unidade, setUnidade] = useState(defaultUnidade);
  const [responsavel, setResponsavel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password
    });

    setLoading(false);
    if (result?.error) {
      setError("Credenciais inválidas. Tente novamente.");
      return;
    }

    window.location.href = "/";
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, accessCode, serie, turma, unidade, responsavel })
    });

    setLoading(false);
    if (!response.ok) {
      const message = response.status === 409
        ? "E-mail já cadastrado."
        : response.status === 403
          ? "Código inválido."
          : "Não foi possível criar o usuário.";
      setError(message);
      return;
    }

    setSuccess("Usuário criado. Faça login para continuar.");
    setMode("login");
  }



  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <RulesBanner collapsible defaultOpen={false} />
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center rounded-3xl bg-white/70 p-8 shadow-sm ring-1 ring-slate-100 backdrop-blur">
          <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Plataforma escolar
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Agendamento de reforço,
                <span className="block text-emerald-700">direto ao ponto.</span>
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Um fluxo claro para organizar aulas, presença e pagamentos antecipados sem ruídos.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Regras resumidas
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  Pagamento antecipado para confirmar a vaga.
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  Cancelamento com aviso evita perda de crédito.
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  Presença registrada libera novos agendamentos.
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  Reagendamentos seguem disponibilidade do professor.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {mode === "login" ? "Acesse sua conta" : "Criar usuário"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {mode === "login" ? "Entre com seu e-mail e senha." : "Cadastre um aluno rapidamente."}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setMode((prev) => (prev === "login" ? "register" : "login"));
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-300"
              >
                {mode === "login" ? "Criar usuário" : "Já tenho conta"}
              </button>
              <a
                href="/login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 shadow-sm hover:border-amber-300 hover:bg-amber-100"
              >
                Abrir em outra aba
              </a>
              <p className="max-w-[180px] text-[11px] text-amber-700/80">
                Se não conseguir abrir aqui, use “Abrir em outra aba”.
              </p>
            </div>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="flex items-center justify-end">
                <a
                  href="/login/esqueci"
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Esqueci minha senha
                </a>
              </div>
              <div>
                <label htmlFor="login-email" className="text-sm font-medium text-slate-700">E-mail</label>
                <input
                  id="login-email"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="login-password" className="text-sm font-medium text-slate-700">Senha</label>
                <input
                  id="login-password"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}
              <button
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                type="submit"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Nome</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">E-mail</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Senha</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">Mínimo 6 caracteres.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Código de acesso</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Responsável</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={responsavel}
                  onChange={(event) => setResponsavel(event.target.value)}
                  placeholder="Nome do responsável"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  O CPF/CNPJ usado nos pagamentos será o do responsável.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Série</label>
                  <input
                    list="serie-options"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={serie}
                    onChange={(event) => setSerie(event.target.value)}
                    placeholder="Ex.: 8º ano"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Turma</label>
                  <input
                    list="turma-options"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={turma}
                    onChange={(event) => setTurma(event.target.value)}
                    placeholder="Ex.: Manhã"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Unidade</label>
                  <input
                    list="unidade-options"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={unidade}
                    onChange={(event) => setUnidade(event.target.value)}
                    placeholder="Ex.: Colégio Raízes"
                  />
                </div>
              </div>
              <datalist id="serie-options">
                {seriesOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <datalist id="turma-options">
                {turmaOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <datalist id="unidade-options">
                <option value={defaultUnidade} />
              </datalist>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}
              <button
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                type="submit"
                disabled={loading}
              >
                {loading ? "Salvando..." : "Criar usuário"}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
