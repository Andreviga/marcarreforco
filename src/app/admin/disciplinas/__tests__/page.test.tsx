import React from "react";
import { render } from "@testing-library/react";
import AdminDisciplinasPage from "@/app/admin/disciplinas/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const AdminSubjectsClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    subject: { findMany: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

jest.mock("@/components/AdminSubjectsClient", () => ({
  __esModule: true,
  default: (props: unknown) => {
    AdminSubjectsClientMock(props);
    return null;
  }
}));

describe("AdminDisciplinasPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const subjectRepo = prisma.subject as unknown as { findMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "admin-1" } });
    subjectRepo.findMany.mockResolvedValue([{ id: "sub1" }]);
  });

  it("renders subjects list", async () => {
    render(await AdminDisciplinasPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Disciplinas", role: "ADMIN" }));
    expect(AdminSubjectsClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ subjects: [{ id: "sub1" }] })
    );
  });
});
