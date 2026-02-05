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

jest.mock("pdfkit", () => {
  return jest.fn().mockImplementation(() => {
    const handlers: Record<string, ((chunk: Uint8Array) => void)[]> = {};
    const doc = {
      page: { height: 800, margins: { bottom: 40 } },
      on: (event: string, cb: (chunk: Uint8Array) => void) => {
        handlers[event] = handlers[event] ?? [];
        handlers[event].push(cb);
      },
      fontSize: () => ({
        text: () => undefined,
        moveDown: () => undefined
      }),
      text: () => undefined,
      moveDown: () => undefined,
      addPage: () => undefined,
      bufferedPageRange: () => ({ start: 0, count: 1 }),
      switchToPage: () => undefined,
      end: () => {
        const chunk = Buffer.from("pdf");
        handlers.data?.forEach((cb) => cb(chunk));
      }
    };
    return { ...doc };
  });
});

describe("export month pdf route", () => {
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
    const response = await GET(new Request("http://localhost/api/invoices/export-month.pdf?month=0&year=2024"));
    expect(response.status).toBe(400);
  });

  it("returns pdf content", async () => {
    invoiceRepo.findMany.mockResolvedValue([
      {
        id: "inv1",
        studentId: "stu1",
        student: { name: "Ana" },
        month: 1,
        year: 2024,
        status: "ABERTA",
        totalCents: 2000,
        items: []
      }
    ]);

    const response = await GET(new Request("http://localhost/api/invoices/export-month.pdf?month=1&year=2024"));
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/pdf");
    expect(buffer.length).toBeGreaterThan(0);
  });
});
