import React from "react";
import { render } from "@testing-library/react";
import AdminFechamentoPage from "@/app/admin/fechamento/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const AdminFechamentoClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findMany: jest.fn() },
    attendance: { findMany: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

jest.mock("@/components/AdminFechamentoClient", () => ({
  __esModule: true,
  default: (props: unknown) => {
    AdminFechamentoClientMock(props);
    return null;
  }
}));

describe("AdminFechamentoPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const invoiceRepo = prisma.invoice as unknown as { findMany: jest.Mock };
  const attendanceRepo = prisma.attendance as unknown as { findMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "admin-1" } });
    invoiceRepo.findMany.mockResolvedValue([{ id: "inv1" }]);
    attendanceRepo.findMany.mockResolvedValue([
      {
        id: "att1",
        studentId: "stu-1",
        student: { name: "Aluno" },
        session: {
          priceCents: 2000,
          subjectId: "sub1",
          subject: { name: "Matemática" },
          teacherId: "t1",
          teacher: { name: "Ana" },
          startsAt: new Date("2024-01-10T10:00:00.000Z")
        }
      }
    ]);
  });

  it("builds reports and renders fechamento", async () => {
    render(await AdminFechamentoPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Fechamento do mês", role: "ADMIN" }));
    expect(AdminFechamentoClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        invoices: [{ id: "inv1" }],
        reports: expect.objectContaining({
          totalByStudent: expect.any(Array),
          totalBySubject: expect.any(Array),
          totalByTeacher: expect.any(Array),
          totalByMonth: expect.any(Array),
          presenceRanking: expect.any(Array)
        })
      })
    );
  });
});
