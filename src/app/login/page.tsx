"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [showAdminBootstrap, setShowAdminBootstrap] = useState(false);
  const [serie, setSerie] = useState("");
  const [turma, setTurma] = useState("");
  const [unidade, setUnidade] = useState("");
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
      body: JSON.stringify({ name, email, password, accessCode, serie, turma, unidade })
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

  async function handleRequestAdminToken() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/auth/bootstrap-admin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail })
    });

    setLoading(false);
    if (!response.ok) {
      const message = response.status === 409
        ? "Admin já existe."
        : response.status === 403
          ? "E-mail não autorizado."
          : "Não foi possível enviar o token.";
      setError(message);
      return;
    }

    setSuccess("Token enviado para o e-mail informado.");
  }

  async function handleBootstrapAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/auth/bootstrap-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        token: adminToken
      })
    });

    setLoading(false);
    if (!response.ok) {
      const message = response.status === 409
        ? "Admin já existe ou e-mail já cadastrado."
        : response.status === 403
          ? "Token inválido ou expirado."
          : "Não foi possível criar o admin.";
      setError(message);
      return;
    }

    setSuccess("Admin criado. Faça login para continuar.");
    setShowAdminBootstrap(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center rounded-3xl bg-white/70 p-8 shadow-sm ring-1 ring-slate-100 backdrop-blur">
          <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Reforço Escolar
          </span>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Gestão de reforço com acompanhamento simples e humano.
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Organize sessões, matrículas e presença em um painel bonito e responsivo para toda a equipe.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
              Agenda semanal centralizada
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
              Controle de alunos, professores e disciplinas
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
              Faturamento e presença com poucos cliques
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
          </div>

          {mode === "login" ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                  required
                />
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Série</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={serie}
                    onChange={(event) => setSerie(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Turma</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={turma}
                    onChange={(event) => setTurma(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Unidade</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={unidade}
                    onChange={(event) => setUnidade(event.target.value)}
                  />
                </div>
              </div>
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

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAdminBootstrap((prev) => !prev)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {showAdminBootstrap ? "Ocultar criação de admin" : "Criar admin inicial"}
            </button>

            {showAdminBootstrap && (
              <form onSubmit={handleBootstrapAdmin} className="mt-3 space-y-3 rounded-2xl border border-slate-100 p-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Nome</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={adminName}
                    onChange={(event) => setAdminName(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">E-mail</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    required
                  />
                </div>
                <button
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:border-slate-300"
                  type="button"
                  onClick={handleRequestAdminToken}
                  disabled={loading}
                >
                  {loading ? "Enviando..." : "Enviar token por e-mail"}
                </button>
                <div>
                  <label className="text-xs font-medium text-slate-600">Senha</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Token recebido por e-mail</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={adminToken}
                    onChange={(event) => setAdminToken(event.target.value)}
                    required
                  />
                </div>
                <button
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Criando..." : "Criar admin"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
