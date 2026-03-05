/** @jest-environment node */

import { DELETE } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { asaasFetch } from "@/lib/asaas";
import { logAudit } from "@/lib/audit";

jest.mock("@/lib/api-auth", () => ({ requireApiRole: jest.fn() }));
jest.mock("@/lib/asaas", () => ({ asaasFetch: jest.fn() }));
jest.mock("@/lib/audit", () => ({ logAudit: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    asaasPayment: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

describe("admin cancel payment route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const asaasFetchMock = asaasFetch as jest.Mock;
  const paymentRepo = prisma.asaasPayment as unknown as {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  const logAuditMock = logAudit as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({ session: { user: { id: "admin-1" } }, response: null });
  });

  it("cancels pending payment", async () => {
    paymentRepo.findUnique.mockResolvedValue({
      id: "pay-1",
      asaasId: "asaas-1",
      status: "PENDING",
      package: { name: "Pacote X" },
      user: { name: "Aluno 1" }
    });
    paymentRepo.update.mockResolvedValue({ id: "pay-1", status: "CANCELED" });

    const response = await DELETE(new Request("http://localhost"), { params: { id: "pay-1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(asaasFetchMock).toHaveBeenCalledWith("/payments/asaas-1", { method: "DELETE" });
    expect(paymentRepo.update).toHaveBeenCalledWith({ where: { id: "pay-1" }, data: { status: "CANCELED" } });
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "ADMIN_CANCEL_PAYMENT" }));
    expect(data.payment.status).toBe("CANCELED");
  });

  it("blocks cancellation for confirmed payment", async () => {
    paymentRepo.findUnique.mockResolvedValue({
      id: "pay-2",
      asaasId: "asaas-2",
      status: "CONFIRMED",
      package: { name: "Pacote Y" },
      user: { name: "Aluno 2" }
    });

    const response = await DELETE(new Request("http://localhost"), { params: { id: "pay-2" } });

    expect(response.status).toBe(400);
    expect(asaasFetchMock).not.toHaveBeenCalled();
    expect(paymentRepo.update).not.toHaveBeenCalled();
  });
});
