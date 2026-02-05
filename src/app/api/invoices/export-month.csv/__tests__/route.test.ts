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
      findMany: jest.fn()
    }
  }
}));

describe("export month csv route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const invoiceRepo = prisma.invoice as unknown as { findMany: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({
      session: { user: { role: "ALUNO", id: "stu1" } },
      response: null
    });
  });

  it("returns 400 for invalid month", async () => {
    const response = await GET(new Request("http://localhost/api/invoices/export-month.csv?month=0&year=2024"));
    expect(response.status).toBe(400);
  });

  it("returns csv with header and rows", async () => {
    invoiceRepo.findMany.mockResolvedValue([
      {
        id: "inv1",
        studentId: "stu1",
        student: { name: "Ana" },
        month: 1,
        year: 2024,
        status: "ABERTA",
        totalCents: 2000
      }
    ]);

    const response = await GET(new Request("http://localhost/api/invoices/export-month.csv?month=1&year=2024"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(text).toContain("Relatorio de faturas");
    expect(text).toContain("Aluno ID");
    expect(text).toContain("Ana");
  });
});
