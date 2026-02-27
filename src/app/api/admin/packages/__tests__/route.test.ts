/** @jest-environment node */

import { DELETE } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

jest.mock("@/lib/api-auth", () => ({ requireApiRole: jest.fn() }));
jest.mock("@/lib/audit", () => ({ logAudit: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    sessionPackage: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    },
    asaasPayment: {
      count: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn()
    },
    asaasSubscription: {
      count: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

describe("admin packages delete", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const packageRepo = prisma.sessionPackage as unknown as {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  const paymentRepo = prisma.asaasPayment as unknown as { count: jest.Mock; updateMany: jest.Mock; findMany: jest.Mock };
  const subscriptionRepo = prisma.asaasSubscription as unknown as { count: jest.Mock; updateMany: jest.Mock; findMany: jest.Mock };
  const txMock = prisma.$transaction as jest.Mock;
  const logAuditMock = logAudit as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({ session: { user: { id: "admin-1" } }, response: null });
    txMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return arg({
          asaasPayment: { updateMany: paymentRepo.updateMany },
          asaasSubscription: { updateMany: subscriptionRepo.updateMany },
          sessionPackage: { delete: packageRepo.delete }
        });
      }
      return [];
    });
  });

  it("deletes package when only canceled links exist by migrating history", async () => {
    packageRepo.findUnique
      .mockResolvedValueOnce({ name: "Avulso", _count: { subscriptions: 2, payments: 3 } })
      .mockResolvedValueOnce(null);
    paymentRepo.count.mockResolvedValue(0);
    subscriptionRepo.count.mockResolvedValue(0);
    packageRepo.create.mockResolvedValue({ id: "removed-pkg" });
    paymentRepo.updateMany.mockResolvedValue({ count: 3 });
    subscriptionRepo.updateMany.mockResolvedValue({ count: 2 });
    packageRepo.delete.mockResolvedValue({ id: "pkg-1" });

    const response = await DELETE(new Request("http://localhost/api/admin/packages?id=pkg-1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(txMock).toHaveBeenCalled();
    expect(data.ok).toBe(true);
    expect(data.migratedCanceledLinksTo).toBe("removed-pkg");
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "DELETE_PACKAGE" }));
  });

  it("blocks delete when active links exist", async () => {
    packageRepo.findUnique.mockResolvedValue({ name: "Avulso", _count: { subscriptions: 4, payments: 5 } });
    paymentRepo.count.mockResolvedValue(2);
    subscriptionRepo.count.mockResolvedValue(1);
    subscriptionRepo.findMany.mockResolvedValue([
      { id: "sub-1", status: "ACTIVE", asaasId: "sub_a", user: { name: "Aluno 1", email: "a@a.com" }, nextDueDate: null }
    ]);
    paymentRepo.findMany.mockResolvedValue([
      { id: "pay-1", status: "PENDING", asaasId: "pay_a", dueDate: null, user: { name: "Aluno 1", email: "a@a.com" } }
    ]);

    const response = await DELETE(new Request("http://localhost/api/admin/packages?id=pkg-1"));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.links.activePayments).toBe(2);
    expect(data.links.activeSubscriptions).toBe(1);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("allows delete when only historical payments exist", async () => {
    packageRepo.findUnique
      .mockResolvedValueOnce({ name: "Avulso", _count: { subscriptions: 0, payments: 6 } })
      .mockResolvedValueOnce({ id: "removed-pkg" });
    paymentRepo.count.mockResolvedValue(0);
    subscriptionRepo.count.mockResolvedValue(0);
    txMock.mockResolvedValue([{ count: 6 }, { count: 0 }, { id: "pkg-2" }]);
    paymentRepo.updateMany.mockResolvedValue({ count: 6 });
    subscriptionRepo.updateMany.mockResolvedValue({ count: 0 });
    packageRepo.delete.mockResolvedValue({ id: "pkg-2" });

    const response = await DELETE(new Request("http://localhost/api/admin/packages?id=pkg-2"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.migratedCanceledLinksTo).toBe("removed-pkg");
  });

  it("force deletes package with active links", async () => {
    packageRepo.findUnique
      .mockResolvedValueOnce({ name: "Avulso", _count: { subscriptions: 2, payments: 3 } })
      .mockResolvedValueOnce({ id: "removed-pkg" });
    paymentRepo.count.mockResolvedValue(2);
    subscriptionRepo.count.mockResolvedValue(1);
    paymentRepo.updateMany.mockResolvedValue({ count: 3 });
    subscriptionRepo.updateMany.mockResolvedValue({ count: 2 });
    packageRepo.delete.mockResolvedValue({ id: "pkg-force" });

    const response = await DELETE(new Request("http://localhost/api/admin/packages?id=pkg-force&force=1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.forceDelete).toBe(true);
    expect(data.migratedPayments).toBe(3);
    expect(data.migratedSubscriptions).toBe(2);
    expect(paymentRepo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELED" }) })
    );
  });
});
