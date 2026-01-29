import React from "react";
import { render } from "@testing-library/react";
import AlunoAgendaPage from "@/app/aluno/agenda/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const AgendaClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findMany: jest.fn() },
    enrollment: { findMany: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

jest.mock("@/components/AgendaClient", () => ({
  __esModule: true,
  default: (props: unknown) => {
    AgendaClientMock(props);
    return null;
  }
}));

describe("AlunoAgendaPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const sessionRepo = prisma.session as unknown as { findMany: jest.Mock };
  const enrollmentRepo = prisma.enrollment as unknown as { findMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "stu-1" } });
    sessionRepo.findMany.mockResolvedValue([{ id: "sess1" }]);
    enrollmentRepo.findMany.mockResolvedValue([{ id: "enr1" }]);
  });

  it("renders agenda with sessions and enrollments", async () => {
    render(await AlunoAgendaPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ALUNO"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Agenda de reforços", role: "ALUNO" }));
    expect(AgendaClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessions: [{ id: "sess1" }], enrollments: [{ id: "enr1" }] })
    );
  });
});
