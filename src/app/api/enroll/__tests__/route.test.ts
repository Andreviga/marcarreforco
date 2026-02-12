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
    session: {
      findUnique: jest.fn()
    },
    enrollment: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    studentCreditBalance: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    studentCreditLedger: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn()
}));

describe("enroll route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const logAuditMock = logAudit as jest.Mock;
  const sessionRepo = prisma.session as unknown as { findUnique: jest.Mock };
  const enrollmentRepo = prisma.enrollment as unknown as { findUnique: jest.Mock; upsert: jest.Mock };
  const transactionMock = prisma.$transaction as jest.Mock;

  const txMock = {
    enrollment: {
      upsert: jest.fn()
    },
    studentCreditBalance: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    studentCreditLedger: {
      create: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock)
    );
    requireApiRoleMock.mockResolvedValue({
      session: { user: { id: "student-1" } },
      response: null
    });
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
      startsAt: new Date(Date.now() + 86400000),
      subjectId: "sub1",
      subject: { name: "Matemática" },
      teacher: { name: "Ana" }
    });
    enrollmentRepo.findUnique.mockResolvedValue(null);
    txMock.studentCreditBalance.findUnique.mockResolvedValue({ studentId: "student-1", subjectId: "sub1", balance: 1 });
    txMock.enrollment.upsert.mockResolvedValue({ id: "e1", sessionId: "s1" });
    txMock.studentCreditBalance.update.mockResolvedValue({ studentId: "student-1", subjectId: "sub1", balance: 0 });
    txMock.studentCreditLedger.create.mockResolvedValue({ id: "ledger1" });

    const request = new Request("http://localhost/api/enroll", {
      method: "POST",
      body: JSON.stringify({ sessionId: "s1" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enrollment).toEqual({ id: "e1", sessionId: "s1" });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "student-1",
        action: "ENROLL",
        entityType: "Enrollment",
        entityId: "e1"
      })
    );
  });
});
