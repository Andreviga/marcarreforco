import React from "react";
import { render } from "@testing-library/react";
import AlunoAgendaPage from "@/app/aluno/agenda/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBalancesForStudent } from "@/lib/credits";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const AgendaClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findMany: jest.fn() },
    enrollment: { findMany: jest.fn() },
    invoice: { findUnique: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() }
  }
}));

jest.mock("@/lib/credits", () => ({
  getBalancesForStudent: jest.fn()
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
  const invoiceRepo = prisma.invoice as unknown as {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    groupBy: jest.Mock;
  };
  const balancesRepo = getBalancesForStudent as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "stu-1" } });
    sessionRepo.findMany.mockResolvedValue([
      {
        id: "sess1",
        startsAt: new Date("2024-01-10T10:00:00.000Z"),
        endsAt: new Date("2024-01-10T11:00:00.000Z"),
        location: "Sala 1",
        modality: "PRESENCIAL",
        priceCents: 2000,
        status: "ATIVA",
        subject: { name: "Matemática" },
        teacher: { name: "Ana" }
      }
    ]);
    enrollmentRepo.findMany.mockResolvedValue([{ id: "enr1" }]);
    invoiceRepo.findUnique.mockResolvedValue(null);
    invoiceRepo.findMany.mockResolvedValue([]);
    invoiceRepo.groupBy.mockResolvedValue([]);
    balancesRepo.mockResolvedValue([]);
  });

  it("renders agenda with sessions and enrollments", async () => {
    render(await AlunoAgendaPage({ searchParams: {} }));

    expect(requireRoleMock).toHaveBeenCalledWith(["ALUNO"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Agenda de reforços", role: "ALUNO" }));
    expect(AgendaClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessions: expect.arrayContaining([expect.objectContaining({ id: "sess1" })]),
        enrollments: [{ id: "enr1" }]
      })
    );
  });
});
