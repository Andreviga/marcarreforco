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

jest.mock("pdfkit", () => {
  return jest.fn().mockImplementation(() => {
    const handlers: Record<string, ((chunk: Uint8Array) => void)[]> = {};
    return {
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
      end: () => {
        const chunk = Buffer.from("pdf");
        handlers.data?.forEach((cb) => cb(chunk));
      }
    };
  });
});

describe("invoice export pdf route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const invoiceRepo = prisma.invoice as unknown as { findUnique: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({ response: null });
  });

  it("returns 404 when invoice missing", async () => {
    invoiceRepo.findUnique.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/invoices/1/export.pdf"), {
      params: { id: "1" }
    });

    expect(response.status).toBe(404);
  });

  it("returns pdf content", async () => {
    invoiceRepo.findUnique.mockResolvedValue({
      id: "inv1",
      student: { name: "Ana" },
      month: 1,
      year: 2024,
      status: "ABERTA",
      totalCents: 2000,
      items: [
        {
          occurredAt: new Date("2024-01-10T10:00:00.000Z"),
          session: { subject: { name: "Matemática" }, teacher: { name: "Ana" } },
          attendance: { status: "PRESENTE" },
          amountCents: 2000
        }
      ]
    });

    const response = await GET(new Request("http://localhost/api/invoices/inv1/export.pdf"), {
      params: { id: "inv1" }
    });
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/pdf");
    expect(buffer.length).toBeGreaterThan(0);
  });
});
