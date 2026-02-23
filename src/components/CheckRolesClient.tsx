"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function CheckRolesClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState({ total: 0, byRole: { ADMIN: 0, PROFESSOR: 0, ALUNO: 0 } });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  async function loadUsers() {
    setLoading(true);
    const response = await fetch("/api/admin/check-roles");
    const data = await response.json();
    setUsers(data.users || []);
    setSummary(data.summary || { total: 0, byRole: { ADMIN: 0, PROFESSOR: 0, ALUNO: 0 } });
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateRole(userId: string, newRole: string, userName: string) {
    if (!confirm(`Tem certeza que deseja alterar a role de "${userName}" para "${newRole}"?`)) {
      return;
    }

    const response = await fetch("/api/admin/check-roles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, newRole })
    });

    if (response.ok) {
      alert("Role atualizada com sucesso! O usuário precisará fazer logout e login novamente.");
      loadUsers();
    } else {
      const data = await response.json();
      alert(`Erro: ${data.message || "Não foi possível atualizar"}`);
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesFilter = filter === "ALL" || user.role === filter;
    const matchesSearch = search === "" || 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Total de Usuários</p>
          <p className="text-3xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm text-emerald-700">Administradores</p>
          <p className="text-3xl font-bold text-emerald-900">{summary.byRole.ADMIN}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-4 shadow-sm">
          <p className="text-sm text-blue-700">Professores</p>
          <p className="text-3xl font-bold text-blue-900">{summary.byRole.PROFESSOR}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-4 shadow-sm">
          <p className="text-sm text-amber-700">Alunos</p>
          <p className="text-3xl font-bold text-amber-900">{summary.byRole.ALUNO}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">Todos os tipos</option>
            <option value="ADMIN">Administradores</option>
            <option value="PROFESSOR">Professores</option>
            <option value="ALUNO">Alunos</option>
          </select>
        </div>
      </div>

      {/* Lista de Usuários */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Usuários ({filteredUsers.length})
          </h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredUsers.map((user) => (
              <div key={user.id} className="p-4 hover:bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-slate-900">{user.name}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <select
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        user.role === "ADMIN"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : user.role === "PROFESSOR"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value, user.name)}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="PROFESSOR">PROFESSOR</option>
                      <option value="ALUNO">ALUNO</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                Nenhum usuário encontrado
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
