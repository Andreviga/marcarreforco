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
    enrollment: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    studentCreditBalance: {
      upsert: jest.fn()
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

describe("unenroll route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const enrollmentRepo = prisma.enrollment as unknown as { findUnique: jest.Mock; update: jest.Mock };
  const logAuditMock = logAudit as jest.Mock;
  const transactionMock = prisma.$transaction as jest.Mock;

  const txMock = {
    enrollment: {
      update: jest.fn()
    },
    studentCreditBalance: {
      upsert: jest.fn()
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

  it("returns 404 when enrollment does not belong to student", async () => {
    enrollmentRepo.findUnique.mockResolvedValue({
      id: "e1",
      studentId: "other",
      session: { status: "ATIVA", startsAt: new Date(Date.now() + 86400000), subjectId: "sub1" }
    });

    const request = new Request("http://localhost/api/unenroll", {
      method: "POST",
      body: JSON.stringify({ enrollmentId: "e1" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toBe("Inscrição não encontrada");
  });

  it("updates enrollment status", async () => {
    enrollmentRepo.findUnique.mockResolvedValue({
      id: "e1",
      studentId: "student-1",
      sessionId: "sess1",
      creditsReserved: 1,
      session: { status: "ATIVA", startsAt: new Date(Date.now() + 86400000), subjectId: "sub1" }
    });
    txMock.enrollment.update.mockResolvedValue({ id: "e1", status: "DESMARCADO", sessionId: "sess1", creditsReserved: 1 });
    txMock.studentCreditBalance.upsert.mockResolvedValue({ id: "balance1" });
    txMock.studentCreditLedger.create.mockResolvedValue({ id: "ledger1" });

    const request = new Request("http://localhost/api/unenroll", {
      method: "POST",
      body: JSON.stringify({ enrollmentId: "e1" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enrollment).toEqual({ id: "e1", status: "DESMARCADO", sessionId: "sess1", creditsReserved: 1 });
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "UNENROLL" }));
  });
});
