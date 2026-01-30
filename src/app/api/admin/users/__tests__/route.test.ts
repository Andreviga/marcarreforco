/** @jest-environment node */

import { GET, POST, PATCH } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcrypt";

jest.mock("@/lib/api-auth", () => ({
  requireApiRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    teacherSubject: {
      createMany: jest.fn(),
      deleteMany: jest.fn()
    },
    studentProfile: {
      upsert: jest.fn()
    },
    teacherProfile: {
      upsert: jest.fn()
    }
  }
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn()
}));

jest.mock("bcrypt", () => ({
  __esModule: true,
  default: {
    hash: jest.fn()
  }
}));

describe("admin users route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const logAuditMock = logAudit as jest.Mock;
  const userRepo = prisma.user as unknown as { findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  const studentProfileRepo = prisma.studentProfile as unknown as { upsert: jest.Mock };
  const teacherProfileRepo = prisma.teacherProfile as unknown as { upsert: jest.Mock };
  const teacherSubjectRepo = prisma.teacherSubject as unknown as { createMany: jest.Mock; deleteMany: jest.Mock };
  const bcryptHashMock = (bcrypt as unknown as { hash: jest.Mock }).hash;

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({
      session: { user: { id: "admin-1" } },
      response: null
    });
  });

  it("returns users list", async () => {
    userRepo.findMany.mockResolvedValue([{ id: "u1", name: "Ana" }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toEqual([{ id: "u1", name: "Ana" }]);
  });

  it("creates a student user", async () => {
    bcryptHashMock.mockResolvedValue("hash");
    userRepo.create.mockResolvedValue({ id: "u1", name: "Aluno" });

    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Aluno",
        email: "aluno@example.com",
        password: "senha123",
        role: "ALUNO",
        serie: "9º ano",
        turma: "Manhã",
        unidade: "Colégio Raízes"
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual({ id: "u1", name: "Aluno" });
    expect(studentProfileRepo.upsert).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATE_USER" }));
  });

  it("updates user as professor with subjects", async () => {
    userRepo.update.mockResolvedValue({ id: "u2", name: "Prof" });

    const request = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({
        id: "u2",
        role: "PROFESSOR",
        subjectIds: ["s1", "s2"]
      })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual({ id: "u2", name: "Prof" });
    expect(teacherProfileRepo.upsert).toHaveBeenCalled();
    expect(teacherSubjectRepo.deleteMany).toHaveBeenCalledWith({ where: { teacherId: "u2" } });
    expect(teacherSubjectRepo.createMany).toHaveBeenCalled();
  });
});
