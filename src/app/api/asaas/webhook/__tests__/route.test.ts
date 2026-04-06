/** @jest-environment node */

import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { addPaymentCredits } from "@/lib/credits";

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
    },
    subject: {
      findFirst: jest.fn()
    }
  }
}));

jest.mock("@/lib/credits", () => ({
  addPaymentCredits: jest.fn(),
  adjustCredits: jest.fn()
}));

describe("asaas webhook route", () => {
  const paymentRepo = prisma.asaasPayment as unknown as {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };
  const subscriptionRepo = prisma.asaasSubscription as unknown as {
    updateMany: jest.Mock;
  };
  const ledgerRepo = prisma.studentCreditLedger as unknown as {
    findFirst: jest.Mock;
  };
  const subjectRepo = prisma.subject as unknown as {
    findFirst: jest.Mock;
  };
  const addPaymentCreditsMock = addPaymentCredits as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASAAS_WEBHOOK_TOKEN = "token";
  });

  it("keeps subscription as INACTIVE when Asaas sends ACTIVE without confirmed payment", async () => {
    paymentRepo.findFirst.mockResolvedValue(null);

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

  it("sets subscription as ACTIVE when there is confirmed payment", async () => {
    paymentRepo.findFirst.mockResolvedValue({ id: "pay_1" });

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

  it("adds credits to specific subject when PAYMENT_CONFIRMED for package with subjectId", async () => {
    const payment = {
      id: "pay_db_1",
      userId: "user_1",
      paidAt: null,
      package: { subjectId: "subj_1", sessionCount: 4 }
    };
    paymentRepo.findUnique.mockResolvedValue(payment);
    (prisma.asaasPayment as unknown as { update: jest.Mock }).update.mockResolvedValue(payment);
    ledgerRepo.findFirst.mockResolvedValue(null); // not yet credited
    subscriptionRepo.updateMany.mockResolvedValue({});

    const request = new Request("http://localhost/api/asaas/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "asaas-access-token": "token"
      },
      body: JSON.stringify({
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: "pay_asaas_1",
          status: "CONFIRMED",
          value: 100,
          subscription: null
        }
      })
    });

    await POST(request);

    expect(addPaymentCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "subj_1", amount: 4 })
    );
  });

  it("adds credits to A DEFINIR subject when PAYMENT_CONFIRMED for subscription package without subjectId", async () => {
    const payment = {
      id: "pay_db_2",
      userId: "user_1",
      paidAt: null,
      package: { subjectId: null, sessionCount: 8 }
    };
    paymentRepo.findUnique.mockResolvedValue(payment);
    (prisma.asaasPayment as unknown as { update: jest.Mock }).update.mockResolvedValue(payment);
    ledgerRepo.findFirst.mockResolvedValue(null); // not yet credited
    subjectRepo.findFirst.mockResolvedValue({ id: "subj_wildcard" });
    subscriptionRepo.updateMany.mockResolvedValue({});

    const request = new Request("http://localhost/api/asaas/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "asaas-access-token": "token"
      },
      body: JSON.stringify({
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: "pay_asaas_2",
          status: "CONFIRMED",
          value: 200,
          subscription: null
        }
      })
    });

    await POST(request);

    expect(subjectRepo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { equals: "A DEFINIR", mode: "insensitive" } } })
    );
    expect(addPaymentCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "subj_wildcard", amount: 8 })
    );
  });

  it("does not add credits when already credited", async () => {
    const payment = {
      id: "pay_db_3",
      userId: "user_1",
      paidAt: null,
      package: { subjectId: "subj_1", sessionCount: 4 }
    };
    paymentRepo.findUnique.mockResolvedValue(payment);
    (prisma.asaasPayment as unknown as { update: jest.Mock }).update.mockResolvedValue(payment);
    ledgerRepo.findFirst.mockResolvedValue({ id: "ledger_1" }); // already credited
    subscriptionRepo.updateMany.mockResolvedValue({});

    const request = new Request("http://localhost/api/asaas/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "asaas-access-token": "token"
      },
      body: JSON.stringify({
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: "pay_asaas_3",
          status: "CONFIRMED",
          value: 100,
          subscription: null
        }
      })
    });

    await POST(request);

    expect(addPaymentCreditsMock).not.toHaveBeenCalled();
  });
});