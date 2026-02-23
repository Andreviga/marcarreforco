"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const phoneNumber = "+551127419849";
  const message = "Ola! Esqueci minha senha e preciso de ajuda para acessar.";
  const whatsappLink = `https://wa.me/${phoneNumber.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    setLoading(false);
    if (!response.ok) {
      setError("Não foi possível enviar o e-mail. Tente novamente.");
      return;
    }

    setSuccess("Se existir uma conta, enviamos o link de redefinicao.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-8 shadow-lg ring-1 ring-slate-100">
        <p className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          Recuperacao de acesso
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Esqueci minha senha</h1>
        <p className="mt-3 text-sm text-slate-600">
          Enviaremos um link de redefinicao por e-mail. Se preferir, fale com a secretaria no WhatsApp.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">E-mail cadastrado</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            {loading ? "Enviando..." : "Enviar link por e-mail"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          WhatsApp da secretaria: <span className="font-semibold">{phoneNumber}</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={whatsappLink}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            Solicitar senha no WhatsApp
          </a>
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
