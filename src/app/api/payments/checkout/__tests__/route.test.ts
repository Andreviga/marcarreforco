/** @jest-environment node */

import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { asaasFetch } from "@/lib/asaas";

jest.mock("@/lib/api-auth", () => ({
  requireApiRole: jest.fn().mockResolvedValue({
    session: { user: { id: "user-1", name: "Aluno", email: "aluno@example.com", role: "ALUNO" } },
    response: null
  })
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    sessionPackage: { findUnique: jest.fn() },
    studentProfile: { findUnique: jest.fn() },
    asaasCustomer: { findUnique: jest.fn(), create: jest.fn() },
    asaasSubscription: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    asaasPayment: { findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn() }
  }
}));

jest.mock("@/lib/asaas", () => ({
  asaasFetch: jest.fn(),
  normalizeDocument: (value: string) => value.replace(/\D/g, ""),
  isValidDocument: jest.fn().mockReturnValue(true)
}));

jest.mock("@/lib/audit", () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));

describe("payments checkout route", () => {
  const asaasFetchMock = asaasFetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.sessionPackage.findUnique as jest.Mock).mockResolvedValue({
      id: "package-1",
      name: "Pacote Matemática",
      active: true,
      billingType: "PACKAGE",
      priceCents: 12000,
      subject: { name: "Matemática" }
    });
    (prisma.studentProfile.findUnique as jest.Mock).mockResolvedValue({ document: "52998224725" });
    (prisma.asaasCustomer.findUnique as jest.Mock).mockResolvedValue({ asaasId: "customer-1" });
    (prisma.asaasPayment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.asaasPayment.create as jest.Mock).mockResolvedValue({ id: "db-payment-1" });
  });

  it("returns inline PIX data while preserving the external Asaas URL", async () => {
    asaasFetchMock
      .mockResolvedValueOnce({
        id: "asaas-payment-1",
        status: "PENDING",
        invoiceUrl: "https://sandbox.asaas.com/i/example",
        dueDate: "2026-08-01",
        value: 120,
        billingType: "PIX"
      })
      .mockResolvedValueOnce({
        encodedImage: "aW1hZ2U=",
        payload: "000201PIX-COPIA-E-COLA",
        expirationDate: "2026-08-01T12:00:00Z"
      });

    const response = await POST(new Request("http://localhost/api/payments/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packageId: "package-1" })
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      paymentId: "db-payment-1",
      paymentUrl: "https://sandbox.asaas.com/i/example",
      pix: {
        encodedImage: "aW1hZ2U=",
        payload: "000201PIX-COPIA-E-COLA",
        expirationDate: "2026-08-01T12:00:00Z"
      }
    });
    expect(asaasFetchMock).toHaveBeenNthCalledWith(2, "/payments/asaas-payment-1/pixQrCode", {
      method: "GET"
    });
  });

  it("keeps a successful checkout when the inline PIX lookup fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    asaasFetchMock
      .mockResolvedValueOnce({
        id: "asaas-payment-1",
        status: "PENDING",
        invoiceUrl: "https://www.asaas.com/i/example",
        value: 120,
        billingType: "PIX"
      })
      .mockRejectedValueOnce(new Error("QR Code ainda indisponível"));

    const response = await POST(new Request("http://localhost/api/payments/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packageId: "package-1" })
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      paymentId: "db-payment-1",
      paymentUrl: "https://www.asaas.com/i/example",
      pix: null
    });
  });
});
