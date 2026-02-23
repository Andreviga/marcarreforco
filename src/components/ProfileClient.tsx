"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  studentProfile?: {
    serie: string | null;
    turma: string | null;
    unidade: string | null;
    document: string | null;
  } | null;
  teacherProfile?: {
    subjects: { subject: { id: string; name: string } }[];
  } | null;
}

interface Subject {
  id: string;
  name: string;
}

export default function ProfileClient({ 
  initialUser, 
  subjects 
}: { 
  initialUser: UserProfile;
  subjects: Subject[];
}) {
  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(initialUser.name);
  const [email, setEmail] = useState(initialUser.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Dados específicos de aluno
  const [serie, setSerie] = useState(initialUser.studentProfile?.serie || "");
  const [turma, setTurma] = useState(initialUser.studentProfile?.turma || "");
  const [unidade, setUnidade] = useState(initialUser.studentProfile?.unidade || "");
  const [document, setDocument] = useState(initialUser.studentProfile?.document || "");
  
  // Dados específicos de professor
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    initialUser.teacherProfile?.subjects.map(ts => ts.subject.id) || []
  );

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Função para formatar CPF/CNPJ com máscara
  function formatDocument(value: string) {
    const cleaned = value.replace(/\D/g, "");
    
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      return cleaned
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
  }

  function handleDocumentChange(value: string) {
    const formatted = formatDocument(value);
    setDocument(formatted);
  }

  function toggleSubject(subjectId: string) {
    setSelectedSubjects(prev => 
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    // Validações
    if (newPassword && newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);

    const updateData: any = { name, email };

    if (newPassword) {
      updateData.currentPassword = currentPassword;
      updateData.newPassword = newPassword;
    }

    if (user.role === "ALUNO") {
      updateData.serie = serie || null;
      updateData.turma = turma || null;
      updateData.unidade = unidade || null;
      updateData.document = document.replace(/\D/g, "") || null;
    }

    if (user.role === "PROFESSOR") {
      updateData.subjectIds = selectedSubjects;
    }

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "Erro ao atualizar perfil");
      setLoading(false);
      return;
    }

    setMessage("Perfil atualizado com sucesso!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);

    // Se alterou email ou senha, fazer logout
    if (newPassword || email !== initialUser.email) {
      setMessage("Perfil atualizado! Você será redirecionado para fazer login novamente...");
      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 2000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dados Básicos */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Dados Básicos</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Nome completo
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          
          <label className="text-sm text-slate-600">
            Email
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">
              Tipo de conta
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                value={user.role}
                disabled
              />
            </label>
          </div>
        </div>
      </div>

      {/* Dados de Aluno */}
      {user.role === "ALUNO" && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Dados do Aluno</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Série
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Ex: 9º ano"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
              />
            </label>

            <label className="text-sm text-slate-600">
              Turma
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Ex: A"
                value={turma}
                onChange={(e) => setTurma(e.target.value)}
              />
            </label>

            <label className="text-sm text-slate-600">
              Unidade
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Ex: Unidade Centro"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
              />
            </label>

            <label className="text-sm text-slate-600">
              CPF/CNPJ
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="000.000.000-00"
                value={document}
                onChange={(e) => handleDocumentChange(e.target.value)}
                maxLength={18}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Necessário para pagamentos
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Dados de Professor */}
      {user.role === "PROFESSOR" && subjects.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Disciplinas que leciona</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <label
                key={subject.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedSubjects.includes(subject.id)}
                  onChange={() => toggleSubject(subject.id)}
                />
                <span className="text-sm text-slate-700">{subject.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Alterar Senha */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Alterar Senha</h2>
        <p className="mt-1 text-sm text-slate-500">
          Deixe em branco se não quiser alterar a senha
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-sm text-slate-600">
            Senha atual
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <label className="text-sm text-slate-600">
            Nova senha
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
            />
          </label>

          <label className="text-sm text-slate-600">
            Confirmar nova senha
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-6 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>
    </form>
  );
}
