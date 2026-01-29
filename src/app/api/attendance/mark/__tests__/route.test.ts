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
      findUnique: jest.fn()
    },
    attendance: {
      upsert: jest.fn()
    }
  }
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn()
}));

describe("attendance mark route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const logAuditMock = logAudit as jest.Mock;
  const enrollmentRepo = prisma.enrollment as unknown as { findUnique: jest.Mock };
  const attendanceRepo = prisma.attendance as unknown as { upsert: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({
      session: { user: { id: "teacher-1" } },
      response: null
    });
  });

  it("returns 404 when enrollment is missing", async () => {
    enrollmentRepo.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost/api/attendance/mark", {
      method: "POST",
      body: JSON.stringify({ enrollmentId: "e1", status: "PRESENTE" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toBe("Inscrição não encontrada");
  });

  it("marks attendance", async () => {
    enrollmentRepo.findUnique.mockResolvedValue({
      id: "e1",
      status: "AGENDADO",
      studentId: "stu-1",
      sessionId: "sess-1",
      session: { status: "ATIVA" }
    });
    attendanceRepo.upsert.mockResolvedValue({ id: "a1", status: "PRESENTE" });

    const request = new Request("http://localhost/api/attendance/mark", {
      method: "POST",
      body: JSON.stringify({ enrollmentId: "e1", status: "PRESENTE", note: "ok" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.attendance).toEqual({ id: "a1", status: "PRESENTE" });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "teacher-1",
        action: "MARK_ATTENDANCE",
        entityType: "Attendance",
        entityId: "a1"
      })
    );
  });
});
