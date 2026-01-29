/** @jest-environment node */

import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    }
  }
}));

jest.mock("bcrypt", () => ({
  __esModule: true,
  default: {
    compare: jest.fn()
  }
}));

describe("auth login route", () => {
  const userRepo = prisma.user as unknown as { findUnique: jest.Mock };
  const bcryptCompareMock = (bcrypt as unknown as { compare: jest.Mock }).compare;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects missing credentials", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects unknown user", async () => {
    userRepo.findUnique.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "x@example.com", password: "123" })
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid password", async () => {
    userRepo.findUnique.mockResolvedValue({ id: "u1", email: "x@example.com", passwordHash: "hash" });
    bcryptCompareMock.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "x@example.com", password: "wrong" })
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns user data on success", async () => {
    userRepo.findUnique.mockResolvedValue({
      id: "u1",
      name: "Ana",
      email: "ana@example.com",
      role: "ADMIN",
      passwordHash: "hash"
    });
    bcryptCompareMock.mockResolvedValue(true);

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "ana@example.com", password: "ok" })
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: "u1",
      name: "Ana",
      email: "ana@example.com",
      role: "ADMIN"
    });
  });
});
