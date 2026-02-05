"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Token ausente. Verifique o link recebido.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter no minimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });

    setLoading(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.message ?? "Nao foi possivel redefinir a senha.");
      return;
    }

    setSuccess("Senha atualizada. Voce ja pode fazer login.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-8 shadow-lg ring-1 ring-slate-100">
        <h1 className="text-2xl font-semibold text-slate-900">Redefinir senha</h1>
        <p className="mt-3 text-sm text-slate-600">
          Crie uma nova senha para acessar sua conta.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Nova senha</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Confirmar senha</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
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
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/login"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-slate-300"
          >
            Voltar para o login
          </a>
        </div>
      </div>
    </div>
  );
}
