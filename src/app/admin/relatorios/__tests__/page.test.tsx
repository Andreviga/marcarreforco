import React from "react";
import { render } from "@testing-library/react";
import AdminRelatoriosPage from "@/app/admin/relatorios/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    enrollment: { count: jest.fn() },
    attendance: { count: jest.fn(), groupBy: jest.fn() },
    asaasPayment: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    asaasSubscription: { count: jest.fn() },
    user: { findMany: jest.fn() },
    subject: { findMany: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

describe("AdminRelatoriosPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const sessionRepo = prisma.session as unknown as { count: jest.Mock; groupBy: jest.Mock; findMany: jest.Mock };
  const enrollmentRepo = prisma.enrollment as unknown as { count: jest.Mock };
  const attendanceRepo = prisma.attendance as unknown as { count: jest.Mock; groupBy: jest.Mock };
  const paymentRepo = prisma.asaasPayment as unknown as {
    aggregate: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
    groupBy: jest.Mock;
  };
  const subscriptionRepo = prisma.asaasSubscription as unknown as { count: jest.Mock };
  const userRepo = prisma.user as unknown as { findMany: jest.Mock };
  const subjectRepo = prisma.subject as unknown as { findMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "admin-1" } });

    sessionRepo.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(17)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(15);

    enrollmentRepo.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(10);

    attendanceRepo.count
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2);

    paymentRepo.aggregate.mockResolvedValue({ _sum: { amountCents: 123400 }, _count: { _all: 12 } });
    paymentRepo.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    subscriptionRepo.count.mockResolvedValue(6);

    attendanceRepo.groupBy.mockResolvedValue([{ studentId: "u1", _count: { studentId: 3 } }]);
    sessionRepo.groupBy
      .mockResolvedValueOnce([{ subjectId: "sub1", _count: { _all: 8 } }])
      .mockResolvedValueOnce([{ teacherId: "t1", _count: { _all: 6 } }]);
    sessionRepo.findMany.mockResolvedValue([{
      id: "sess1",
      subject: { name: "Matemática" },
      teacher: { name: "Professor 1" },
      startsAt: new Date("2024-01-10T12:30:00.000Z"),
      endsAt: new Date("2024-01-10T13:20:00.000Z"),
      status: "ATIVA",
      _count: { enrollments: 3, attendances: 2 }
    }]);
    paymentRepo.findMany.mockResolvedValue([{ id: "p1", user: { name: "Ana" }, package: { name: "Pacote 4" }, amountCents: 9900 }]);
    paymentRepo.groupBy.mockResolvedValue([{ status: "CONFIRMED", _count: { _all: 3 }, _sum: { amountCents: 20000 } }]);
    userRepo.findMany
      .mockResolvedValueOnce([{ id: "u1", name: "Aluno 1" }])
      .mockResolvedValueOnce([{ id: "t1", name: "Professor 1" }]);
    subjectRepo.findMany.mockResolvedValue([{ id: "sub1", name: "Matemática" }]);
  });

  it("loads report data and renders inside AppShell", async () => {
    render(await AdminRelatoriosPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Relatórios", role: "ADMIN" }));
    expect(sessionRepo.count).toHaveBeenCalledTimes(6);
    expect(enrollmentRepo.count).toHaveBeenCalledTimes(3);
    expect(attendanceRepo.groupBy).toHaveBeenCalled();
    expect(paymentRepo.aggregate).toHaveBeenCalled();
    expect(paymentRepo.findMany).toHaveBeenCalled();
    expect(sessionRepo.groupBy).toHaveBeenCalledTimes(2);
    expect(paymentRepo.groupBy).toHaveBeenCalled();
  });
});
