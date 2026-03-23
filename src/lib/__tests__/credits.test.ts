/** @jest-environment node */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    studentCreditLot: {
      findMany: jest.fn()
    },
    studentCreditBalance: {
      findMany: jest.fn()
    },
    subject: {
      findMany: jest.fn()
    }
  }
}));

describe("getBalancesForStudent", () => {
  let getBalancesForStudent: typeof import("@/lib/credits").getBalancesForStudent;
  let prismaModule: typeof import("@/lib/prisma");

  beforeEach(async () => {
    jest.resetModules();
    ({ getBalancesForStudent } = await import("@/lib/credits"));
    prismaModule = await import("@/lib/prisma");
    jest.clearAllMocks();
  });

  it("falls back to legacy balance when there are no active lots", async () => {
    const lotRepo = prismaModule.prisma.studentCreditLot as unknown as { findMany: jest.Mock };
    const legacyRepo = prismaModule.prisma.studentCreditBalance as unknown as { findMany: jest.Mock };
    const subjectRepo = prismaModule.prisma.subject as unknown as { findMany: jest.Mock };

    lotRepo.findMany.mockResolvedValue([]);
    legacyRepo.findMany.mockResolvedValue([{ studentId: "stu1", subjectId: "sub1", balance: 3 }]);
    subjectRepo.findMany.mockResolvedValue([{ id: "sub1", name: "Matemática" }]);

    const result = await getBalancesForStudent("stu1");

    expect(result).toEqual([
      {
        subject: { id: "sub1", name: "Matemática" },
        balance: 3
      }
    ]);
  });

  it("prefers active lot balance over legacy balance for the same subject", async () => {
    const lotRepo = prismaModule.prisma.studentCreditLot as unknown as { findMany: jest.Mock };
    const legacyRepo = prismaModule.prisma.studentCreditBalance as unknown as { findMany: jest.Mock };
    const subjectRepo = prismaModule.prisma.subject as unknown as { findMany: jest.Mock };

    lotRepo.findMany.mockResolvedValue([
      { studentId: "stu1", subjectId: "sub1", remaining: 2 },
      { studentId: "stu1", subjectId: "sub1", remaining: 1 }
    ]);
    legacyRepo.findMany.mockResolvedValue([{ studentId: "stu1", subjectId: "sub1", balance: 7 }]);
    subjectRepo.findMany.mockResolvedValue([{ id: "sub1", name: "Matemática" }]);

    const result = await getBalancesForStudent("stu1");

    expect(result).toEqual([
      {
        subject: { id: "sub1", name: "Matemática" },
        balance: 3
      }
    ]);
  });
});
