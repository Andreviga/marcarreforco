/** @jest-environment node */

import { GET, POST, PATCH, DELETE } from "../route";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

jest.mock("@/lib/api-auth", () => ({
  requireApiRole: jest.fn()
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    session: {
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

describe("admin sessions route", () => {
  const requireApiRoleMock = requireApiRole as jest.Mock;
  const logAuditMock = logAudit as jest.Mock;
  const sessionRepo = prisma.session as unknown as {
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    requireApiRoleMock.mockResolvedValue({
      session: { user: { id: "admin-1" } },
      response: null
    });
  });

  it("returns sessions list", async () => {
    sessionRepo.findMany.mockResolvedValue([{ id: "sess1" }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessions).toEqual([{ id: "sess1" }]);
  });

  it("creates a session", async () => {
    sessionRepo.create.mockResolvedValue({ id: "sess1" });

    const request = new Request("http://localhost/api/admin/sessions", {
      method: "POST",
      body: JSON.stringify({
        subjectId: "sub1",
        teacherId: "t1",
        startsAt: "2024-01-10T10:00:00.000Z",
        endsAt: "2024-01-10T11:00:00.000Z",
        location: "Sala 1",
        modality: "PRESENCIAL",
        priceCents: 4000
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session).toEqual({ id: "sess1" });
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATE_SESSION" }));
  });

  it("updates a session", async () => {
    sessionRepo.update.mockResolvedValue({ id: "sess1" });

    const request = new Request("http://localhost/api/admin/sessions", {
      method: "PATCH",
      body: JSON.stringify({ id: "sess1", status: "CANCELADA" })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.session).toEqual({ id: "sess1" });
  });

  it("deletes a session", async () => {
    sessionRepo.delete.mockResolvedValue({ id: "sess1" });

    const request = new Request("http://localhost/api/admin/sessions?id=sess1", {
      method: "DELETE"
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "DELETE_SESSION" }));
  });
});
