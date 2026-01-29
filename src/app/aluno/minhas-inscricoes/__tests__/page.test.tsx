import React from "react";
import { render } from "@testing-library/react";
import MinhasInscricoesPage from "@/app/aluno/minhas-inscricoes/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const InscricoesClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findMany: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

jest.mock("@/components/InscricoesClient", () => ({
  __esModule: true,
  default: (props: unknown) => {
    InscricoesClientMock(props);
    return null;
  }
}));

describe("MinhasInscricoesPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const enrollmentRepo = prisma.enrollment as unknown as { findMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "stu-1" } });
    enrollmentRepo.findMany.mockResolvedValue([{ id: "enr1" }]);
  });

  it("renders enrollments list", async () => {
    render(await MinhasInscricoesPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ALUNO"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Minhas inscrições", role: "ALUNO" }));
    expect(InscricoesClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ enrollments: [{ id: "enr1" }] })
    );
  });
});
