import React from "react";
import { render } from "@testing-library/react";
import AdminLimpezaPage from "@/app/admin/limpeza/page";
import { requireRole } from "@/lib/rbac";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const AdminCleanupClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({ requireRole: jest.fn() }));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

jest.mock("@/components/AdminCleanupClient", () => ({
  __esModule: true,
  default: (props: unknown) => {
    AdminCleanupClientMock(props);
    return null;
  }
}));

describe("AdminLimpezaPage", () => {
  const requireRoleMock = requireRole as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("renders cleanup page for admin", async () => {
    render(await AdminLimpezaPage());

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"]);
    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Limpeza de dados", role: "ADMIN" }));
    expect(AdminCleanupClientMock).toHaveBeenCalled();
  });
});
