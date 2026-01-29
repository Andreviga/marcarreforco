/** @jest-environment node */

import { GET } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/api-auth", () => ({
  requireApiRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      findUnique: jest.fn()
    }
  }
}));

describe("invoice export csv route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const invoiceRepo = prisma.invoice as unknown as { findUnique: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({ response: null });
  });

  it("returns 404 when invoice missing", async () => {
    invoiceRepo.findUnique.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/invoices/1/export.csv"), {
      params: { id: "1" }
    });

    expect(response.status).toBe(404);
  });

  it("returns csv content", async () => {
    invoiceRepo.findUnique.mockResolvedValue({
      id: "inv1",
      items: [
        {
          occurredAt: new Date("2024-01-10T10:00:00.000Z"),
          sessionId: "sess1",
          session: { subject: { name: "Matemática" }, teacher: { name: "Ana" } },
          attendance: { status: "PRESENTE" },
          amountCents: 2000
        }
      ]
    });

    const response = await GET(new Request("http://localhost/api/invoices/inv1/export.csv"), {
      params: { id: "inv1" }
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(text).toContain("Matemática");
  });
});
