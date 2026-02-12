"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  studentProfile?: { serie: string; turma: string; unidade: string } | null;
  teacherProfile?: { subjects: { id: string; name: string }[] } | null;
}

interface Subject {
  id: string;
  name: string;
}

const seriesOptions = [
  "1º ano",
  "2º ano",
  "3º ano",
  "4º ano",
  "5º ano",
  "6º ano",
  "7º ano",
  "8º ano",
  "9º ano",
  "1ª série",
  "2ª série",
  "3ª série"
];

const turmaOptions = ["Manhã", "Tarde"];

const defaultUnidade = "Colégio Raízes";

export default function AdminUsersClient({ users, subjects }: { users: UserRow[]; subjects: Subject[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ALUNO");
  const [serie, setSerie] = useState("");
  const [turma, setTurma] = useState("");
  const [unidade, setUnidade] = useState(defaultUnidade);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<null | {
    created: number;
    skippedExisting: number;
    duplicateInFile: number;
    invalidRows: number;
    details?: {
      skippedExisting?: string[];
      duplicateInFile?: string[];
      invalidRows?: string[];
      errors?: string[];
    };
  }>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("ALUNO");
  const [editSerie, setEditSerie] = useState("");
  const [editTurma, setEditTurma] = useState("");
  const [editUnidade, setEditUnidade] = useState(defaultUnidade);
  const [editSubjectIds, setEditSubjectIds] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordMessage, setEditPasswordMessage] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, serie, turma, unidade, subjectIds })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const fieldErrors = data?.issues?.fieldErrors
        ? Object.entries(data.issues.fieldErrors)
            .filter(([, messages]) => Array.isArray(messages) && messages.length)
            .map(([field, messages]) => {
              if (!Array.isArray(messages)) return null;
              return `${field}: ${messages.join(", ")}`;
            })
            .filter((item): item is string => Boolean(item))
            .join(" | ")
        : null;
      setFormError(fieldErrors ?? data?.message ?? "Não foi possível criar o usuário.");
      return;
    }
    setFormSuccess("Usuário criado com sucesso.");
    window.location.reload();
  }

  function toggleSubject(id: string) {
    setSubjectIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleEditSubject(id: string) {
    setEditSubjectIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function startEdit(user: UserRow) {
    setEditError(null);
    setEditSuccess(null);
    setEditingId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditSerie(user.studentProfile?.serie ?? "");
    setEditTurma(user.studentProfile?.turma ?? "");
    setEditUnidade(user.studentProfile?.unidade ?? defaultUnidade);
    setEditSubjectIds(user.teacherProfile?.subjects.map((subject) => subject.id) ?? []);
    setEditPassword("");
    setEditPasswordMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
    setEditSuccess(null);
    setEditPassword("");
    setEditPasswordMessage(null);
  }

  async function handleUpdate() {
    if (!editingId) return;
    setEditError(null);
    setEditSuccess(null);

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name: editName,
        email: editEmail,
        role: editRole,
        serie: editRole === "ALUNO" ? editSerie : undefined,
        turma: editRole === "ALUNO" ? editTurma : undefined,
        unidade: editRole === "ALUNO" ? editUnidade : undefined,
        subjectIds: editRole === "PROFESSOR" ? editSubjectIds : undefined,
        password: editPassword ? editPassword : undefined
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const fieldErrors = data?.issues?.fieldErrors
        ? Object.entries(data.issues.fieldErrors)
            .filter(([, messages]) => Array.isArray(messages) && messages.length)
            .map(([field, messages]) => {
              if (!Array.isArray(messages)) return null;
              return `${field}: ${messages.join(", ")}`;
            })
            .filter((item): item is string => Boolean(item))
            .join(" | ")
        : null;
      setEditError(fieldErrors ?? data?.message ?? "Não foi possível atualizar o usuário.");
      return;
    }

    setEditSuccess(editPassword ? "Usuário atualizado e senha redefinida." : "Usuário atualizado com sucesso.");
    if (editPassword) {
      setEditPassword("");
      setEditPasswordMessage(null);
    }
    window.location.reload();
  }

  function generateTempPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 10; i += 1) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    setEditPassword(result);
    setEditPasswordMessage("Senha temporária gerada. Envie para o usuário.");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(result).catch(() => null);
    }
  }

  async function handleDelete(user: UserRow) {
    const confirmed = window.confirm(`Excluir o usuário ${user.name}? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;
    setEditError(null);
    setEditSuccess(null);

    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setEditError(data?.message ?? "Não foi possível excluir o usuário.");
      return;
    }

    window.location.reload();
  }

  function normalize(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("pt-BR");
  }

  function parseRole(raw: string) {
    const value = normalize(raw);
    if (value === "aluno" || value === "student") return "ALUNO";
    if (value === "professor" || value === "prof" || value === "teacher") return "PROFESSOR";
    if (value === "admin" || value === "secretaria" || value === "secretario") return "ADMIN";
    return "ALUNO";
  }

  function downloadTemplate() {
    const header = ["nome", "email", "senha", "perfil", "serie", "turma", "unidade", "disciplinas"];
    const example = ["Ana Souza", "ana@colegio.com", "123456", "ALUNO", "8º ano", "Manhã", defaultUnidade, "Matemática, Português"];
    const worksheet = XLSX.utils.aoa_to_sheet([header, example]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "usuarios");
    const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "usuarios_template.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    setImportError(null);
    setImportResult(null);
    setImporting(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Planilha vazia");
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
      if (rows.length < 2) {
        throw new Error("A planilha precisa ter cabeçalho e pelo menos 1 linha de dados");
      }

      const headers = rows[0].map((value) => normalize(String(value)));
      const headerIndex = (name: string) => headers.indexOf(normalize(name));

      const idxName = headerIndex("nome");
      const idxEmail = headerIndex("email");
      const idxPassword = headerIndex("senha");
      const idxRole = headerIndex("perfil");
      const idxSerie = headerIndex("serie");
      const idxTurma = headerIndex("turma");
      const idxUnidade = headerIndex("unidade");
      const idxSubjects = headerIndex("disciplinas");

      if (idxName === -1 || idxEmail === -1 || idxPassword === -1 || idxRole === -1) {
        throw new Error("Cabeçalho inválido. Use o modelo fornecido.");
      }

      const subjectMap = new Map(subjects.map((subject) => [normalize(subject.name), subject.id]));

      const payload = rows.slice(1).reduce((acc, row, index) => {
        const nameValue = String(row[idxName] ?? "").trim();
        const emailValue = String(row[idxEmail] ?? "").trim();
        const passwordValue = String(row[idxPassword] ?? "").trim();
        const roleValue = String(row[idxRole] ?? "").trim();

        if (!nameValue && !emailValue) return acc;

        const roleParsed = parseRole(roleValue || "ALUNO");
        const subjectNames = idxSubjects !== -1 ? String(row[idxSubjects] ?? "") : "";
        const subjectIdsParsed = subjectNames
          .split(",")
          .map((item) => normalize(item))
          .filter(Boolean)
          .map((item) => subjectMap.get(item))
          .filter((item): item is string => Boolean(item));

        acc.push({
          _rowNumber: index + 2,
          name: nameValue,
          email: emailValue,
          password: passwordValue,
          role: roleParsed,
          serie: idxSerie !== -1 ? String(row[idxSerie] ?? "").trim() : undefined,
          turma: idxTurma !== -1 ? String(row[idxTurma] ?? "").trim() : undefined,
          unidade: idxUnidade !== -1 ? String(row[idxUnidade] ?? "").trim() : undefined,
          subjectIds: subjectIdsParsed.length ? subjectIdsParsed : undefined
        });

        return acc;
      }, [] as Array<{ _rowNumber: number; name: string; email: string; password: string; role: string; serie?: string; turma?: string; unidade?: string; subjectIds?: string[] }>);

      if (!payload.length) {
        throw new Error("Nenhum usuário válido foi encontrado");
      }

      const response = await fetch("/api/admin/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: payload })
      });

      if (!response.ok) {
        throw new Error("Falha ao importar usuários");
      }

      const result = await response.json();
      setImportResult(result);
      window.location.reload();
    } catch (error) {
      setImportError((error as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Novo usuário</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Nome
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Ana Souza"
            />
            <span className="mt-1 block text-xs text-slate-400">Nome completo do usuário.</span>
          </label>
          <label className="text-sm text-slate-600">
            E-mail
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex.: ana@colegio.com"
            />
            <span className="mt-1 block text-xs text-slate-400">Usado para login e notificações.</span>
          </label>
          <label className="text-sm text-slate-600">
            Senha
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
            <span className="mt-1 block text-xs text-slate-400">Mínimo 6 caracteres.</span>
          </label>
          <label className="text-sm text-slate-600">
            Perfil
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="ALUNO">Aluno</option>
              <option value="PROFESSOR">Professor</option>
              <option value="ADMIN">Secretaria/Admin</option>
            </select>
          </label>
        </div>

        {role === "ALUNO" && (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-sm text-slate-600">
                Série
                <input
                  list="admin-serie-options"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={serie}
                  onChange={(e) => setSerie(e.target.value)}
                  placeholder="Ex.: 8º ano"
                />
                <span className="mt-1 block text-xs text-slate-400">Informe o ano/série do aluno.</span>
              </label>
              <label className="text-sm text-slate-600">
                Turma
                <input
                  list="admin-turma-options"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={turma}
                  onChange={(e) => setTurma(e.target.value)}
                  placeholder="Ex.: Manhã"
                />
                <span className="mt-1 block text-xs text-slate-400">Manhã ou tarde.</span>
              </label>
              <label className="text-sm text-slate-600">
                Unidade
                <input
                  list="admin-unidade-options"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  placeholder="Ex.: Colégio Raízes"
                />
                <span className="mt-1 block text-xs text-slate-400">Campus/unidade escolar.</span>
              </label>
            </div>
            <datalist id="admin-serie-options">
              {seriesOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <datalist id="admin-turma-options">
              {turmaOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <datalist id="admin-unidade-options">
              <option value={defaultUnidade} />
            </datalist>
          </>
        )}

        {role === "PROFESSOR" && (
          <div className="mt-4">
            <p className="text-sm text-slate-600">Disciplinas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <button
                  type="button"
                  key={subject.id}
                  onClick={() => toggleSubject(subject.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${subjectIds.includes(subject.id) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}
                >
                  {subject.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
        {formSuccess && <p className="mt-3 text-sm text-emerald-600">{formSuccess}</p>}
        <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
          Criar usuário
        </button>
      </form>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Importar usuários (Excel)</h2>
            <p className="text-sm text-slate-500">Use o modelo para preencher a planilha.</p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300"
          >
            Baixar modelo
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                handleImport(file);
              }
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-500">Formatos: .xlsx, .csv</span>
        </div>
        {importing && <p className="mt-3 text-sm text-slate-500">Importando...</p>}
        {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}
        {importResult && (
          <p className="mt-3 text-sm text-slate-600">
            Importados: {importResult.created} • Existentes: {importResult.skippedExisting} • Duplicados no arquivo: {importResult.duplicateInFile} • Inválidos: {importResult.invalidRows}
          </p>
        )}
        {importResult?.details && (
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {importResult.details.invalidRows?.map((item) => <li key={item}>Inválido: {item}</li>)}
            {importResult.details.duplicateInFile?.map((item) => <li key={item}>Duplicado: {item}</li>)}
            {importResult.details.skippedExisting?.map((item) => <li key={item}>Já existe: {item}</li>)}
            {importResult.details.errors?.map((item) => <li key={item}>Erro: {item}</li>)}
          </ul>
        )}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Lista de usuários</h2>
        <div className="mt-3 grid gap-2">
          {users.map((user) => (
            <div key={user.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{user.name}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(user)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-300"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(user)}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 hover:border-rose-300"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                <p>E-mail: {user.email}</p>
                <p>Perfil: {user.role}</p>
                <p>ID: {user.id}</p>
                <p>Cadastrado em: {formatDate(user.createdAt)}</p>
                {user.studentProfile ? (
                  <p>
                    Aluno: {user.studentProfile.serie} • {user.studentProfile.turma} • {user.studentProfile.unidade}
                  </p>
                ) : (
                  <p>Aluno: -</p>
                )}
                {user.teacherProfile ? (
                  <p>
                    Disciplinas: {user.teacherProfile.subjects.length ? user.teacherProfile.subjects.map((subject) => subject.name).join(", ") : "-"}
                  </p>
                ) : (
                  <p>Disciplinas: -</p>
                )}
              </div>

              {editingId === user.id && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-slate-600">
                      Nome
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Ex.: Ana Souza"
                      />
                      <span className="mt-1 block text-[11px] text-slate-400">Atualize o nome completo.</span>
                    </label>
                    <label className="text-xs text-slate-600">
                      E-mail
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Ex.: ana@colegio.com"
                      />
                      <span className="mt-1 block text-[11px] text-slate-400">Este e-mail será o login.</span>
                    </label>
                    <label className="text-xs text-slate-600">
                      Perfil
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                      >
                        <option value="ALUNO">Aluno</option>
                        <option value="PROFESSOR">Professor</option>
                        <option value="ADMIN">Secretaria/Admin</option>
                      </select>
                      <span className="mt-1 block text-[11px] text-slate-400">Aluno, professor ou secretaria.</span>
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-slate-600">
                      Nova senha
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Gerar ou digitar"
                      />
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Preencha para redefinir e envie ao usuário.
                      </span>
                    </label>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={generateTempPassword}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
                      >
                        Gerar senha
                      </button>
                      {editPasswordMessage && (
                        <span className="text-[11px] text-emerald-600">{editPasswordMessage}</span>
                      )}
                    </div>
                  </div>

                  {editRole === "ALUNO" && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <label className="text-xs text-slate-600">
                        Série
                        <input
                          list="admin-serie-options"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={editSerie}
                          onChange={(e) => setEditSerie(e.target.value)}
                          placeholder="Ex.: 8º ano"
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Turma
                        <input
                          list="admin-turma-options"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={editTurma}
                          onChange={(e) => setEditTurma(e.target.value)}
                          placeholder="Ex.: Manhã"
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Unidade
                        <input
                          list="admin-unidade-options"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={editUnidade}
                          onChange={(e) => setEditUnidade(e.target.value)}
                          placeholder="Ex.: Colégio Raízes"
                        />
                      </label>
                    </div>
                  )}

                  {editRole === "PROFESSOR" && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-600">Disciplinas</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {subjects.map((subject) => (
                          <button
                            type="button"
                            key={subject.id}
                            onClick={() => toggleEditSubject(subject.id)}
                            className={`rounded-full border px-3 py-1 text-xs ${editSubjectIds.includes(subject.id) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}
                          >
                            {subject.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {editError && <p className="mt-3 text-xs text-red-600">{editError}</p>}
                  {editSuccess && <p className="mt-3 text-xs text-emerald-600">{editSuccess}</p>}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleUpdate}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
                    >
                      Salvar alterações
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
