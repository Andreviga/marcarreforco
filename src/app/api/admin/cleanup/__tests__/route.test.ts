/** @jest-environment node */

import { POST } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

jest.mock("@/lib/api-auth", () => ({ requireApiRole: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findMany: jest.fn(), deleteMany: jest.fn() },
    enrollment: { deleteMany: jest.fn() },
    user: { findMany: jest.fn(), deleteMany: jest.fn() },
    teacherSubject: { deleteMany: jest.fn() },
    teacherProfile: { deleteMany: jest.fn() },
    subject: { findMany: jest.fn(), deleteMany: jest.fn() },
    auditLog: { create: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn()
  }
}));

jest.mock("@/lib/audit", () => ({ logAudit: jest.fn() }));

describe("admin cleanup route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const sessionRepo = prisma.session as unknown as { findMany: jest.Mock; deleteMany: jest.Mock };
  const userRepo = prisma.user as unknown as { findMany: jest.Mock; deleteMany: jest.Mock };
  const subjectRepo = prisma.subject as unknown as { findMany: jest.Mock; deleteMany: jest.Mock };
  const teacherSubjectRepo = prisma.teacherSubject as unknown as { deleteMany: jest.Mock };
  const teacherProfileRepo = prisma.teacherProfile as unknown as { deleteMany: jest.Mock };
  const txMock = prisma.$transaction as jest.Mock;
  const logAuditMock = logAudit as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({ session: { user: { id: "admin-1" } }, response: null });
  });

  it("runs old canceled sessions cleanup", async () => {
    sessionRepo.findMany.mockResolvedValue([{ id: "s1" }]);
    txMock.mockResolvedValue([{ count: 2 }, { count: 1 }]);

    const req = new Request("http://localhost/api/admin/cleanup", {
      method: "POST",
      body: JSON.stringify({ action: "OLD_CANCELED_SESSIONS" })
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.result.deletedSessions).toBe(1);
    expect(data.result.deletedEnrollments).toBe(2);
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "ADMIN_CLEANUP" }));
  });

  it("returns 400 for invalid action", async () => {
    const req = new Request("http://localhost/api/admin/cleanup", {
      method: "POST",
      body: JSON.stringify({ action: "UNKNOWN" })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("runs test subjects cleanup without touching linked subjects", async () => {
    subjectRepo.findMany.mockResolvedValue([
      {
        id: "sub-unused",
        _count: { sessions: 0, packages: 0, teachers: 0, creditBalances: 0, creditLedger: 0, creditLots: 0 }
      },
      {
        id: "sub-linked",
        _count: { sessions: 1, packages: 0, teachers: 0, creditBalances: 0, creditLedger: 0, creditLots: 0 }
      }
    ]);
    subjectRepo.deleteMany.mockResolvedValue({ count: 1 });

    const req = new Request("http://localhost/api/admin/cleanup", {
      method: "POST",
      body: JSON.stringify({ action: "TEST_SUBJECTS_UNUSED" })
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(subjectRepo.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["sub-unused"] } } });
    expect(data.result.deletedSubjects).toBe(1);
  });

  it("runs test teachers cleanup and keeps teachers with subject links", async () => {
    userRepo.findMany.mockResolvedValue([
      {
        id: "teacher-unused",
        teacherProfile: { subjects: [] },
        _count: { sessions: 0, teacherTickets: 0, attendances: 0, ticketMessages: 0 }
      },
      {
        id: "teacher-linked",
        teacherProfile: { subjects: [{ subjectId: "sub1" }] },
        _count: { sessions: 0, teacherTickets: 0, attendances: 0, ticketMessages: 0 }
      }
    ]);
    txMock.mockResolvedValue([{ count: 0 }, { count: 1 }, { count: 1 }]);

    const req = new Request("http://localhost/api/admin/cleanup", {
      method: "POST",
      body: JSON.stringify({ action: "TEST_TEACHERS_UNUSED" })
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(teacherSubjectRepo.deleteMany).toHaveBeenCalledWith({ where: { teacherId: { in: ["teacher-unused"] } } });
    expect(teacherProfileRepo.deleteMany).toHaveBeenCalledWith({ where: { userId: { in: ["teacher-unused"] } } });
    expect(userRepo.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["teacher-unused"] } } });
    expect(data.result.deletedTeachers).toBe(1);
    expect(data.result.deletedProfiles).toBe(1);
  });
});
