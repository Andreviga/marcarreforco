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

  it("returns 410 when fechamento is disabled", async () => {
    const request = new Request("http://localhost/api/admin/invoices?month=1&year=2024");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.message).toBe("Fechamento desativado. Utilize pagamentos via Asaas.");
  });

  it("returns 410 for patch when fechamento is disabled", async () => {
    const request = new Request("http://localhost/api/admin/invoices", {
      method: "PATCH",
      body: JSON.stringify({ id: "inv1", status: "INVALIDO" })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.message).toBe("Fechamento desativado. Utilize pagamentos via Asaas.");
  });

  it("returns 410 for updates when fechamento is disabled", async () => {
    const request = new Request("http://localhost/api/admin/invoices", {
      method: "PATCH",
      body: JSON.stringify({ id: "inv1", status: "PAGA" })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.message).toBe("Fechamento desativado. Utilize pagamentos via Asaas.");
  });
});
