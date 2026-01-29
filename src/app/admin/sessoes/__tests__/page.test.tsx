import React from "react";
import { render } from "@testing-library/react";
import AdminSessoesPage from "@/app/admin/sessoes/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const AdminSessionsClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findMany: jest.fn() },
    subject: { findMany: jest.fn() },
    user: { findMany: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

jest.mock("@/components/AdminSessionsClient", () => ({
  __esModule: true,
  default: (props: unknown) => {
    AdminSessionsClientMock(props);
    return null;
  }
}));

describe("AdminSessoesPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const sessionRepo = prisma.session as unknown as { findMany: jest.Mock };
  const subjectRepo = prisma.subject as unknown as { findMany: jest.Mock };
  const userRepo = prisma.user as unknown as { findMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "admin-1" } });
    sessionRepo.findMany.mockResolvedValue([{ id: "sess1" }]);
    subjectRepo.findMany.mockResolvedValue([{ id: "sub1" }]);
    userRepo.findMany.mockResolvedValue([{ id: "t1" }]);
  });

  it("renders sessions management", async () => {
    render(await AdminSessoesPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Sessões", role: "ADMIN" }));
    expect(AdminSessionsClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessions: [{ id: "sess1" }], subjects: [{ id: "sub1" }], teachers: [{ id: "t1" }] })
    );
  });
});
