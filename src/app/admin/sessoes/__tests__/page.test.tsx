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
    sessionRepo.findMany.mockResolvedValue([
      {
        id: "sess1",
        startsAt: new Date("2024-01-10T10:00:00.000Z"),
        endsAt: new Date("2024-01-10T11:00:00.000Z"),
        priceCents: 2000,
        status: "ATIVA",
        subject: { name: "Matemática" },
        teacher: { name: "Ana" }
      }
    ]);
    subjectRepo.findMany.mockResolvedValue([{ id: "sub1", name: "Matemática" }]);
    userRepo.findMany.mockResolvedValue([{ id: "t1", name: "Ana" }]);
  });

  it("renders sessions management", async () => {
    render(await AdminSessoesPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Sessões", role: "ADMIN" }));
    expect(AdminSessionsClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessions: expect.arrayContaining([expect.objectContaining({ id: "sess1" })]),
        subjects: expect.arrayContaining([expect.objectContaining({ id: "sub1" })]),
        teachers: expect.arrayContaining([expect.objectContaining({ id: "t1" })])
      })
    );
  });
});
