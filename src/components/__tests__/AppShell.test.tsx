import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  )
}));

jest.mock("@/components/SignOutButton", () => ({
  __esModule: true,
  default: () => <button>Mock Sign Out</button>
}));

describe("AppShell", () => {
  it("renders title, subtitle, nav items, and children for admin", () => {
    render(
      <AppShell title="Painel" subtitle="Bem-vindo" role="ADMIN">
        <div>Conteúdo</div>
      </AppShell>
    );

    expect(screen.getByText("Painel")).toBeInTheDocument();
    expect(screen.getByText("Bem-vindo")).toBeInTheDocument();
    expect(screen.getByText("Sessões")).toBeInTheDocument();
    expect(screen.getByText("Usuários")).toBeInTheDocument();
    expect(screen.getByText("Disciplinas")).toBeInTheDocument();
    expect(screen.getByText("Pacotes")).toBeInTheDocument();
    expect(screen.getByText("Pagamentos")).toBeInTheDocument();
    expect(screen.getByText("Relatórios")).toBeInTheDocument();
    expect(screen.getByText("Tickets")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
  });
});
