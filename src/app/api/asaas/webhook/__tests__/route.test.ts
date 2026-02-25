/** @jest-environment node */

import { POST } from "../route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    asaasPayment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn()
    },
    asaasSubscription: {
      findUnique: jest.fn(),
      updateMany: jest.fn()
    },
    studentCreditLedger: {
      findFirst: jest.fn()
    }
  }
}));

jest.mock("@/lib/credits", () => ({
  addPaymentCredits: jest.fn(),
  adjustCredits: jest.fn()
}));

describe("asaas webhook route", () => {
  const subscriptionRepo = prisma.asaasSubscription as unknown as {
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASAAS_WEBHOOK_TOKEN = "token";
    subscriptionRepo.findUnique.mockResolvedValue(null);
  });

  it("keeps subscription as INACTIVE when Asaas sends ACTIVE for a not-yet-activated subscription", async () => {
    const request = new Request("http://localhost/api/asaas/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "asaas-access-token": "token"
      },
      body: JSON.stringify({
        event: "SUBSCRIPTION_UPDATED",
        subscription: {
          id: "sub_asaas_1",
          status: "ACTIVE",
          nextDueDate: "2026-03-10"
        }
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(subscriptionRepo.updateMany).toHaveBeenCalledWith({
      where: {
        asaasId: "sub_asaas_1",
        status: { not: "CANCELED" }
      },
      data: {
        status: "INACTIVE",
        nextDueDate: new Date("2026-03-10")
      }
    });
  });

  it("keeps ACTIVE when Asaas sends ACTIVE for subscription already active locally", async () => {
    subscriptionRepo.findUnique.mockResolvedValue({ status: "ACTIVE" });

    const request = new Request("http://localhost/api/asaas/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "asaas-access-token": "token"
      },
      body: JSON.stringify({
        event: "SUBSCRIPTION_UPDATED",
        subscription: {
          id: "sub_asaas_1",
          status: "ACTIVE"
        }
      })
    });

    await POST(request);

    expect(subscriptionRepo.updateMany).toHaveBeenCalledWith({
      where: {
        asaasId: "sub_asaas_1",
        status: { not: "CANCELED" }
      },
      data: {
        status: "ACTIVE",
        nextDueDate: null
      }
    });
  });
});
