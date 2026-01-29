import React from "react";
import { render } from "@testing-library/react";
import AdminUsuariosPage from "@/app/admin/usuarios/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const AdminUsersClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: jest.fn() },
    subject: { findMany: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

jest.mock("@/components/AdminUsersClient", () => ({
  __esModule: true,
  default: (props: unknown) => {
    AdminUsersClientMock(props);
    return null;
  }
}));

describe("AdminUsuariosPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const userRepo = prisma.user as unknown as { findMany: jest.Mock };
  const subjectRepo = prisma.subject as unknown as { findMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "admin-1" } });
    userRepo.findMany.mockResolvedValue([{ id: "u1" }]);
    subjectRepo.findMany.mockResolvedValue([{ id: "sub1" }]);
  });

  it("renders users management", async () => {
    render(await AdminUsuariosPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Usuários", role: "ADMIN" }));
    expect(AdminUsersClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ users: [{ id: "u1" }], subjects: [{ id: "sub1" }] })
    );
  });
});
