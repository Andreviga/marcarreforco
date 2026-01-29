/** @jest-environment node */

import { GET, PATCH } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

jest.mock("@/lib/api-auth", () => ({
  requireApiRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      findMany: jest.fn(),
      update: jest.fn()
    }
  }
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn()
}));

describe("admin invoices route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const logAuditMock = logAudit as jest.Mock;
  const invoiceRepo = prisma.invoice as unknown as { findMany: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({
      session: { user: { id: "admin-1" } },
      response: null
    });
  });

  it("returns invoices list with filters", async () => {
    invoiceRepo.findMany.mockResolvedValue([{ id: "inv1" }]);

    const request = new Request("http://localhost/api/admin/invoices?month=1&year=2024");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.invoices).toEqual([{ id: "inv1" }]);
  });

  it("validates patch payload", async () => {
    const request = new Request("http://localhost/api/admin/invoices", {
      method: "PATCH",
      body: JSON.stringify({ id: "inv1", status: "INVALIDO" })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Dados inválidos");
  });

  it("updates invoice status", async () => {
    invoiceRepo.update.mockResolvedValue({ id: "inv1", status: "PAGA" });

    const request = new Request("http://localhost/api/admin/invoices", {
      method: "PATCH",
      body: JSON.stringify({ id: "inv1", status: "PAGA" })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.invoice).toEqual({ id: "inv1", status: "PAGA" });
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "UPDATE_INVOICE_STATUS" }));
  });
});
