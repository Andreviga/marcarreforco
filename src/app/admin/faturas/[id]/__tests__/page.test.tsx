import React from "react";
import { render, screen } from "@testing-library/react";
import AdminFaturaDetailPage from "@/app/admin/faturas/[id]/page";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const AppShellMock = jest.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>);
const InvoiceDetailClientMock = jest.fn(() => null);

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: jest.fn() }
  }
}));

jest.mock("@/components/AppShell", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode }) => AppShellMock(props)
}));

jest.mock("@/components/InvoiceDetailClient", () => ({
  __esModule: true,
  default: (props: unknown) => {
    InvoiceDetailClientMock(props);
    return null;
  }
}));

describe("AdminFaturaDetailPage", () => {
  const requireRoleMock = requireRole as jest.Mock;
  const invoiceRepo = prisma.invoice as unknown as { findUnique: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireRoleMock.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("renders not found when invoice missing", async () => {
    invoiceRepo.findUnique.mockResolvedValue(null);

    render(await AdminFaturaDetailPage({ params: { id: "inv1" } }));

    expect(screen.getByText("Fatura não encontrada.")).toBeInTheDocument();
  });

  it("renders invoice details", async () => {
    invoiceRepo.findUnique.mockResolvedValue({
      id: "inv1",
      month: 1,
      year: 2024,
      student: { name: "Ana" },
      items: []
    });

    render(await AdminFaturaDetailPage({ params: { id: "inv1" } }));

    expect(AppShellMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Fatura Ana", role: "ADMIN" }));
    expect(InvoiceDetailClientMock).toHaveBeenCalledWith(expect.objectContaining({ invoice: expect.objectContaining({ id: "inv1" }) }));
  });
});
