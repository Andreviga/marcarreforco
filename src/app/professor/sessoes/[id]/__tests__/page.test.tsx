import React from "react";
import { render, screen } from "@testing-library/react";
import ProfessorSessaoDetailPage from "@/app/professor/sessoes/[id]/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const AttendanceClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findUnique: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

jest.mock("@/components/AttendanceClient", () => ({
  __esModule: true,
  default: (props: unknown) => {
    AttendanceClientMock(props);
    return null;
  }
}));

describe("ProfessorSessaoDetailPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const sessionRepo = prisma.session as unknown as { findUnique: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "prof-1" } });
  });

  it("renders not found when session missing", async () => {
    sessionRepo.findUnique.mockResolvedValue(null);

    render(await ProfessorSessaoDetailPage({ params: { id: "sess1" } }));

    expect(screen.getByText("Sessão não encontrada.")).toBeInTheDocument();
  });

  it("renders attendance list when session belongs to professor", async () => {
    sessionRepo.findUnique.mockResolvedValue({
      id: "sess1",
      teacherId: "prof-1",
      subject: { name: "Matemática" },
      location: "Sala 1",
      enrollments: []
    });

    render(await ProfessorSessaoDetailPage({ params: { id: "sess1" } }));

    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Chamada - Matemática", role: "PROFESSOR" }));
    expect(AttendanceClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "sess1", enrollments: [] })
    );
  });
});
