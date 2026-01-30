import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";

const LinkMock = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href}>{children}</a>
);
LinkMock.displayName = "LinkMock";

jest.mock("next/link", () => ({
  __esModule: true,
  default: LinkMock
}));

const SignOutButtonMock = () => <button>Mock Sign Out</button>;
SignOutButtonMock.displayName = "SignOutButtonMock";

jest.mock("@/components/SignOutButton", () => SignOutButtonMock);

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
    expect(screen.getByText("Fechamento")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
  });
});
