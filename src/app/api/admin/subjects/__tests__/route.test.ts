/** @jest-environment node */

import { GET, POST } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

jest.mock("@/lib/api-auth", () => ({
  requireApiRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    subject: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  }
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn()
}));

describe("admin subjects route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const logAuditMock = logAudit as jest.Mock;
  const subjectRepo = prisma.subject as unknown as {
    findMany: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      response: null
    });
  });

  it("returns subjects list", async () => {
    subjectRepo.findMany.mockResolvedValue([{ id: "s1", name: "Matemática" }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.subjects).toEqual([{ id: "s1", name: "Matemática" }]);
  });

  it("validates subject payload", async () => {
    const request = new Request("http://localhost/api/admin/subjects", {
      method: "POST",
      body: JSON.stringify({ name: "A" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Dados inválidos");
  });

  it("creates subject and logs audit", async () => {
    subjectRepo.create.mockResolvedValue({ id: "s1", name: "Física", defaultPriceCents: 3000 });

    const request = new Request("http://localhost/api/admin/subjects", {
      method: "POST",
      body: JSON.stringify({ name: "Física", defaultPriceCents: 3000 })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.subject).toEqual({ id: "s1", name: "Física", defaultPriceCents: 3000 });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        action: "CREATE_SUBJECT",
        entityType: "Subject",
        entityId: "s1"
      })
    );
  });
});
