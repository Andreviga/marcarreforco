/** @jest-environment node */

import { POST } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

jest.mock("@/lib/api-auth", () => ({
  requireApiRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    attendance: {
      findMany: jest.fn()
    },
    invoice: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    invoiceItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn()
    }
  }
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn()
}));

describe("invoice generate route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const attendanceRepo = prisma.attendance as unknown as { findMany: jest.Mock };
  const invoiceRepo = prisma.invoice as unknown as { findUnique: jest.Mock; upsert: jest.Mock };
  const invoiceItemRepo = prisma.invoiceItem as unknown as { deleteMany: jest.Mock; createMany: jest.Mock };
  const logAuditMock = logAudit as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({
      session: { user: { id: "admin-1" } },
      response: null
    });
  });

  it("generates invoices for attendances", async () => {
    attendanceRepo.findMany.mockResolvedValue([
      {
        id: "att1",
        studentId: "stu-1",
        sessionId: "sess1",
        session: {
          subject: { name: "Matemática" },
          teacher: { name: "Ana" },
          startsAt: new Date("2024-01-10T10:00:00.000Z"),
          priceCents: 2000
        }
      }
    ]);
    invoiceRepo.findUnique.mockResolvedValue(null);
    invoiceRepo.upsert.mockResolvedValue({ id: "inv1" });

    const request = new Request("http://localhost/api/invoices/generate", {
      method: "POST",
      body: JSON.stringify({ month: 1, year: 2024 })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.invoices).toEqual(["inv1"]);
    expect(invoiceItemRepo.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: "inv1" } });
    expect(invoiceItemRepo.createMany).toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "GENERATE_INVOICE" }));
  });
});
