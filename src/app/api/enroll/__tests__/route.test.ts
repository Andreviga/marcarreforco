/** @jest-environment node */

import { POST } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { addPaymentCredits, getBalance, reserveCredit } from "@/lib/credits";
import { sendEmail } from "@/lib/mail";

jest.mock("@/lib/api-auth", () => ({
  requireApiRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: {
      findUnique: jest.fn()
    },
    subject: {
      findFirst: jest.fn()
    },
    asaasPayment: {
      findFirst: jest.fn()
    },
    enrollment: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn()
}));

jest.mock("@/lib/credits", () => ({
  reserveCredit: jest.fn(),
  getBalance: jest.fn(),
  addPaymentCredits: jest.fn()
}));

jest.mock("@/lib/mail", () => ({
  sendEmail: jest.fn()
}));

describe("enroll route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const logAuditMock = logAudit as jest.Mock;
  const reserveCreditMock = reserveCredit as jest.Mock;
  const getBalanceMock = getBalance as jest.Mock;
  const addPaymentCreditsMock = addPaymentCredits as jest.Mock;
  const sendEmailMock = sendEmail as jest.Mock;
  const sessionRepo = prisma.session as unknown as { findUnique: jest.Mock };
  const subjectRepo = prisma.subject as unknown as { findFirst: jest.Mock };
  const paymentRepo = prisma.asaasPayment as unknown as { findFirst: jest.Mock };
  const enrollmentRepo = prisma.enrollment as unknown as { findUnique: jest.Mock; upsert: jest.Mock };
  const transactionMock = prisma.$transaction as jest.Mock;

  const txMock = {
    enrollment: {
      upsert: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock)
    );
    requireApiRoleMock.mockResolvedValue({
      session: { user: { id: "student-1", email: "aluno@example.com", name: "Aluno" } },
      response: null
    });
    subjectRepo.findFirst.mockResolvedValue(null);
    sendEmailMock.mockResolvedValue(undefined);
  });

  it("rejects unavailable session", async () => {
    sessionRepo.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost/api/enroll", {
      method: "POST",
      body: JSON.stringify({ sessionId: "s1" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Sessão indisponível");
  });

  it("enrolls student", async () => {
    sessionRepo.findUnique.mockResolvedValue({
      id: "s1",
      status: "ATIVA",
      startsAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 73 * 60 * 60 * 1000),
      location: "Unidade Centro",
      modality: "PRESENCIAL",
      subjectId: "sub1",
      subject: { name: "Matemática" },
      teacher: { name: "Ana" }
    });
    enrollmentRepo.findUnique.mockResolvedValue(null);
    getBalanceMock.mockResolvedValue(1);
    paymentRepo.findFirst.mockResolvedValue(null);
    txMock.enrollment.upsert.mockResolvedValue({ id: "e1", sessionId: "s1" });
    reserveCreditMock.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/enroll", {
      method: "POST",
      body: JSON.stringify({ sessionId: "s1" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enrollment).toEqual({ id: "e1", sessionId: "s1" });
    expect(reserveCreditMock).toHaveBeenCalled();
    expect(addPaymentCreditsMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "student-1",
        action: "ENROLL",
        entityType: "Enrollment",
        entityId: "e1"
      })
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "aluno@example.com",
        subject: "Agendamento confirmado"
      })
    );
  });

  it("allocates credits from pending payment when balance is zero", async () => {
    sessionRepo.findUnique.mockResolvedValue({
      id: "s1",
      status: "ATIVA",
      startsAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 73 * 60 * 60 * 1000),
      location: "Unidade Centro",
      modality: "PRESENCIAL",
      subjectId: "sub1",
      subject: { name: "Matemática" },
      teacher: { name: "Ana" }
    });
    enrollmentRepo.findUnique.mockResolvedValue(null);
    getBalanceMock.mockResolvedValue(0);
    paymentRepo.findFirst.mockResolvedValue({
      id: "p1",
      paidAt: new Date(),
      package: { sessionCount: 4 }
    });
    txMock.enrollment.upsert.mockResolvedValue({ id: "e1", sessionId: "s1" });
    reserveCreditMock.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/enroll", {
      method: "POST",
      body: JSON.stringify({ sessionId: "s1" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enrollment).toEqual({ id: "e1", sessionId: "s1" });
    expect(addPaymentCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "student-1",
        subjectId: "sub1",
        amount: 4,
        paymentId: "p1"
      })
    );
    expect(reserveCreditMock).toHaveBeenCalled();
  });

  it("rejects enrollment when session is within 48 hours", async () => {
    sessionRepo.findUnique.mockResolvedValue({
      id: "s1",
      status: "ATIVA",
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
      location: "Unidade Centro",
      modality: "PRESENCIAL",
      subjectId: "sub1",
      subject: { name: "Matemática" },
      teacher: { name: "Ana" }
    });

    const request = new Request("http://localhost/api/enroll", {
      method: "POST",
      body: JSON.stringify({ sessionId: "s1" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Agendamento disponível somente com 48 horas de antecedência.");
    expect(reserveCreditMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
