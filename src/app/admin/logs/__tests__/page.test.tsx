import React from "react";
import { render } from "@testing-library/react";
import AdminLogsPage from "@/app/admin/logs/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: jest.fn(),
      groupBy: jest.fn()
    }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

describe("AdminLogsPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const auditRepo = prisma.auditLog as unknown as { findMany: jest.Mock; groupBy: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "admin-1" } });
    auditRepo.findMany.mockResolvedValue([
      {
        id: "l1",
        action: "ENROLL",
        entityType: "Enrollment",
        entityId: "e1",
        createdAt: new Date("2024-01-10T10:00:00.000Z"),
        payloadJson: { sessionId: "s1" },
        actor: { id: "u1", name: "Aluno 1", email: "aluno@x.com", role: "ALUNO" }
      }
    ]);
    auditRepo.groupBy.mockResolvedValue([{ action: "ENROLL", _count: { action: 1 } }]);
  });

  it("renders admin logs data", async () => {
    render(await AdminLogsPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Logs de usuários", role: "ADMIN" }));
    expect(auditRepo.findMany).toHaveBeenCalled();
    expect(auditRepo.groupBy).toHaveBeenCalled();
  });
});
