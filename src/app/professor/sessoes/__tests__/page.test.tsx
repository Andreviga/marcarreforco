import React from "react";
import { render, screen } from "@testing-library/react";
import ProfessorSessoesPage from "@/app/professor/sessoes/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  )
}));

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findMany: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

describe("ProfessorSessoesPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const sessionRepo = prisma.session as unknown as { findMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "prof-1" } });
    sessionRepo.findMany.mockResolvedValue([
      {
        id: "sess1",
        subject: { name: "Matemática" },
        startsAt: new Date("2024-01-10T10:00:00.000Z"),
        endsAt: new Date("2024-01-10T11:00:00.000Z"),
        status: "ATIVA"
      }
    ]);
  });

  it("renders sessions list", async () => {
    render(await ProfessorSessoesPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["PROFESSOR"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Sessões da semana", role: "PROFESSOR" }));
    expect(screen.getByText("Matemática")).toBeInTheDocument();
  });
});
