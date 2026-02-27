/** @jest-environment node */

import { POST } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { releaseCredit } from "@/lib/credits";

jest.mock("@/lib/api-auth", () => ({
  requireApiRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn()
}));

jest.mock("@/lib/credits", () => ({
  releaseCredit: jest.fn()
}));

describe("unenroll route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const enrollmentRepo = prisma.enrollment as unknown as { findUnique: jest.Mock; update: jest.Mock };
  const logAuditMock = logAudit as jest.Mock;
  const releaseCreditMock = releaseCredit as jest.Mock;
  const transactionMock = prisma.$transaction as jest.Mock;

  const txMock = {
    enrollment: {
      update: jest.fn()
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

  it("blocks cancel when less than 48h left", async () => {
    enrollmentRepo.findUnique.mockResolvedValue({
      id: "e1",
      studentId: "student-1",
      sessionId: "sess1",
      creditsReserved: 1,
      session: { status: "ATIVA", startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), subjectId: "sub1" }
    });

    const request = new Request("http://localhost/api/unenroll", {
      method: "POST",
      body: JSON.stringify({ enrollmentId: "e1" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Desmarcação permitida apenas até 48 horas antes da aula.");
  });

  it("updates enrollment status", async () => {
    enrollmentRepo.findUnique.mockResolvedValue({
      id: "e1",
      studentId: "student-1",
      sessionId: "sess1",
      creditsReserved: 1,
      session: { status: "ATIVA", startsAt: new Date(Date.now() + 72 * 60 * 60 * 1000), subjectId: "sub1" }
    });
    txMock.enrollment.update.mockResolvedValue({ id: "e1", status: "DESMARCADO", sessionId: "sess1", creditsReserved: 1 });
    releaseCreditMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/unenroll", {
      method: "POST",
      body: JSON.stringify({ enrollmentId: "e1" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enrollment).toEqual({ id: "e1", status: "DESMARCADO", sessionId: "sess1", creditsReserved: 1 });
    expect(releaseCreditMock).toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "UNENROLL" }));
  });
});
