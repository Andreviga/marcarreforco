import Link from "next/link";
import { ReactNode } from "react";
import SignOutButton from "@/components/SignOutButton";

interface AppShellProps {
  title: string;
  subtitle?: string;
  role: "ALUNO" | "PROFESSOR" | "ADMIN";
  children: ReactNode;
}

const navByRole: Record<string, { href: string; label: string }[]> = {
  ALUNO: [
    { href: "/aluno/agenda", label: "Agenda" },
    { href: "/aluno/minhas-inscricoes", label: "Minhas inscrições" }
  ],
  PROFESSOR: [
    { href: "/professor/sessoes", label: "Sessões" }
  ],
  ADMIN: [
    { href: "/admin/sessoes", label: "Sessões" },
    { href: "/admin/usuarios", label: "Usuários" },
    { href: "/admin/disciplinas", label: "Disciplinas" },
    { href: "/admin/pacotes", label: "Pacotes" },
    { href: "/admin/fechamento", label: "Fechamento" }
  ]
};

export default function AppShell({ title, subtitle, role, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            {(navByRole[role] ?? []).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
              >
                {item.label}
              </Link>
            ))}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
