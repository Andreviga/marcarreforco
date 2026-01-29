/** @jest-environment node */

import { requireAuth, requireRole } from "@/lib/rbac";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn()
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn()
}));

describe("rbac", () => {
  const getServerSessionMock = getServerSession as jest.Mock;
  const redirectMock = redirect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    redirectMock.mockImplementation(() => {
      throw new Error("redirect");
    });
  });

  it("requireAuth redirects when no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("requireAuth returns session", async () => {
    const session = { user: { role: "ADMIN" } };
    getServerSessionMock.mockResolvedValue(session);

    await expect(requireAuth()).resolves.toBe(session);
  });

  it("requireRole redirects when role not allowed", async () => {
    getServerSessionMock.mockResolvedValue({ user: { role: "ALUNO" } });

    await expect(requireRole(["ADMIN"])).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("requireRole returns session when role allowed", async () => {
    const session = { user: { role: "ADMIN" } };
    getServerSessionMock.mockResolvedValue(session);

    await expect(requireRole(["ADMIN"])).resolves.toBe(session);
  });
});
