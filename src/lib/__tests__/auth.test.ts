/** @jest-environment node */


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

describe("authOptions", () => {
  let authOptions: typeof import("@/lib/auth").authOptions;
  let userRepo: { findUnique: jest.Mock };
  let bcryptCompareMock: jest.Mock;

  function getAuthorize() {
    const provider = authOptions.providers?.find((item) => (item as { id?: string }).id === "credentials") as
      | { authorize?: (c: unknown) => Promise<unknown>; options?: { authorize?: (c: unknown) => Promise<unknown> } }
      | undefined;
    return provider?.authorize ?? provider?.options?.authorize;
  }

  beforeEach(async () => {
    jest.resetModules();
    ({ authOptions } = await import("@/lib/auth"));
    const prismaModule = await import("@/lib/prisma");
    userRepo = prismaModule.prisma.user as unknown as { findUnique: jest.Mock };
    const bcryptModule = await import("bcrypt");
    bcryptCompareMock = (bcryptModule.default as { compare: jest.Mock }).compare;
    jest.clearAllMocks();
  });

  it("authorize returns null when missing credentials", async () => {
    const authorize = getAuthorize();

    const result = await authorize?.(null);
    expect(result).toBeNull();
  });

  it("authorize returns null when user not found", async () => {
    const authorize = getAuthorize();
    userRepo.findUnique.mockResolvedValue(null);

    const result = await authorize?.({ email: "x@example.com", password: "123" });

    expect(result).toBeNull();
  });

  it("authorize returns null when password invalid", async () => {
    const authorize = getAuthorize();
    userRepo.findUnique.mockResolvedValue({ id: "u1", email: "x@example.com", passwordHash: "hash" });
    bcryptCompareMock.mockResolvedValue(false);

    const result = await authorize?.({ email: "x@example.com", password: "wrong" });

    expect(result).toBeNull();
  });

  it("jwt callback assigns id and role", async () => {
    const token = await authOptions.callbacks?.jwt?.({
      token: {},
      user: { id: "u1", role: "ADMIN" }
    });

    expect(token).toEqual({ id: "u1", role: "ADMIN" });
  });

  it("session callback assigns id and role", async () => {
    const session = await authOptions.callbacks?.session?.({
      session: { user: { name: "Ana" } },
      token: { id: "u1", role: "ADMIN" }
    });

    expect(session?.user).toEqual({ name: "Ana", id: "u1", role: "ADMIN" });
  });
});
