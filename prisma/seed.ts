import { PrismaClient, Role, Modality, SessionStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { addDays, setHours, setMinutes, startOfWeek } from "date-fns";
import path from "path";
import XLSX from "xlsx";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);
  const defaultPasswordHash = await bcrypt.hash("Raizes123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@colegio.com" },
    update: {},
    create: {
      name: "Secretaria",
      email: "admin@colegio.com",
      passwordHash,
      role: Role.ADMIN
    }
  });

  const student = await prisma.user.upsert({
    where: { email: "aluno@colegio.com" },
    update: {},
    create: {
      name: "Ana Souza",
      email: "aluno@colegio.com",
      passwordHash,
      role: Role.ALUNO,
      studentProfile: {
        create: {
          serie: "8º ano",
          turma: "Manhã",
          unidade: "Colégio Raízes"
        }
      }
    }
  });

  const subjectDefinitions = [
    { name: "Matemática", defaultPriceCents: 5000, teacherName: "Prof. Marcos", teacherEmail: "marcos@colegio.com" },
    { name: "Português", defaultPriceCents: 4500, teacherName: "Profª Ana", teacherEmail: "ana.prof@colegio.com" },
    { name: "Ciências", defaultPriceCents: 4800, teacherName: "Prof. Lucas", teacherEmail: "lucas.prof@colegio.com" },
    { name: "História", defaultPriceCents: 4200, teacherName: "Profª Julia", teacherEmail: "julia.prof@colegio.com" },
    { name: "Geografia", defaultPriceCents: 4200, teacherName: "Prof. Daniel", teacherEmail: "daniel.prof@colegio.com" }
  ];

  const subjects = [] as Array<{ id: string; defaultPriceCents: number; teacherId: string }>;

  for (const subjectDef of subjectDefinitions) {
    const subject = await prisma.subject.upsert({
      where: { name: subjectDef.name },
      update: { defaultPriceCents: subjectDef.defaultPriceCents },
      create: { name: subjectDef.name, defaultPriceCents: subjectDef.defaultPriceCents }
    });

    const teacher = await prisma.user.upsert({
      where: { email: subjectDef.teacherEmail },
      update: { name: subjectDef.teacherName },
      create: {
        name: subjectDef.teacherName,
        email: subjectDef.teacherEmail,
        passwordHash,
        role: Role.PROFESSOR,
        teacherProfile: { create: {} }
      }
    });

    await prisma.teacherSubject.createMany({
      data: [{ teacherId: teacher.id, subjectId: subject.id }],
      skipDuplicates: true
    });

    subjects.push({ id: subject.id, defaultPriceCents: subject.defaultPriceCents, teacherId: teacher.id });
  }

  const subjectMap = new Map(
    (await prisma.subject.findMany()).map((subject) => [normalizeKey(subject.name), subject.id])
  );

  const spreadsheetPath = path.resolve(process.cwd(), "usuarios_template_preenchido_updated_preserved.xlsx");
  const userRows = loadUsersFromSpreadsheet(spreadsheetPath);
  let importedCount = 0;
  let skippedCount = 0;

  for (const row of userRows) {
    if (!row.email) {
      skippedCount += 1;
      continue;
    }

    const role = parseRole(row.perfil);
    if (role === Role.ADMIN) {
      skippedCount += 1;
      continue;
    }

    const user = await prisma.user.upsert({
      where: { email: row.email },
      update: { name: row.nome, role },
      create: {
        name: row.nome,
        email: row.email,
        passwordHash: defaultPasswordHash,
        role,
        studentProfile:
          role === Role.ALUNO
            ? {
                create: {
                  serie: row.serie ?? "",
                  turma: row.turma ?? "",
                  unidade: row.unidade ?? "Colégio Raízes"
                }
              }
            : undefined,
        teacherProfile: role === Role.PROFESSOR ? { create: {} } : undefined
      }
    });

    if (role === Role.ALUNO) {
      await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: {
          serie: row.serie ?? "",
          turma: row.turma ?? "",
          unidade: row.unidade ?? "Colégio Raízes"
        },
        create: {
          userId: user.id,
          serie: row.serie ?? "",
          turma: row.turma ?? "",
          unidade: row.unidade ?? "Colégio Raízes"
        }
      });
    }

    if (role === Role.PROFESSOR) {
      await prisma.teacherProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id }
      });

      const disciplineNames = splitDisciplines(row.disciplinas ?? "");
      const subjectIds: string[] = [];

      for (const name of disciplineNames) {
        const key = normalizeKey(name);
        let subjectId = subjectMap.get(key);
        if (!subjectId) {
          const created = await prisma.subject.upsert({
            where: { name },
            update: {},
            create: { name, defaultPriceCents: 0 }
          });
          subjectId = created.id;
          subjectMap.set(key, subjectId);
        }
        subjectIds.push(subjectId);
      }

      if (subjectIds.length) {
        await prisma.teacherSubject.createMany({
          data: subjectIds.map((subjectId) => ({ teacherId: user.id, subjectId })),
          skipDuplicates: true
        });
      }
    }

    importedCount += 1;
  }

  const baseWeek = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  const sessions = subjects.flatMap((subject) =>
    [1, 2, 3, 4, 5].map((weekday) => ({
      subjectId: subject.id,
      teacherId: subject.teacherId,
      startsAt: setMinutes(setHours(addDays(baseWeek, weekday), 12), 30),
      endsAt: setMinutes(setHours(addDays(baseWeek, weekday), 13), 30),
      location: "Sala 1",
      modality: Modality.PRESENCIAL,
      priceCents: subject.defaultPriceCents,
      status: SessionStatus.ATIVA
    }))
  );

  await prisma.session.createMany({ data: sessions });

  const daysToSessions = (days: number) => days * 4;
  const createPackage = async (params: {
    name: string;
    sessionCount: number;
    priceCents: number;
    subjectId?: string | null;
    billingType?: "PACKAGE" | "SUBSCRIPTION";
    billingCycle?: "MONTHLY" | "WEEKLY" | null;
  }) =>
    prisma.sessionPackage.upsert({
      where: { name: params.name },
      update: {
        sessionCount: params.sessionCount,
        priceCents: params.priceCents,
        active: true,
        subjectId: params.subjectId ?? null,
        billingType: params.billingType ?? "PACKAGE",
        billingCycle: params.billingType === "SUBSCRIPTION" ? params.billingCycle ?? "MONTHLY" : null
      },
      create: {
        name: params.name,
        sessionCount: params.sessionCount,
        priceCents: params.priceCents,
        active: true,
        subjectId: params.subjectId ?? null,
        billingType: params.billingType ?? "PACKAGE",
        billingCycle: params.billingType === "SUBSCRIPTION" ? params.billingCycle ?? "MONTHLY" : null
      }
    });

  const packagesBase = [
    {
      label: "1o ao 3o",
      monthly: [
        { days: 1, priceCents: 2200 },
        { days: 2, priceCents: 3900 },
        { days: 5, priceCents: 8900, name: "Pacote especial 5 dias/semana" }
      ],
      avulsoPriceCents: 700
    },
    {
      label: "4o ao 9o",
      monthly: [
        { days: 1, priceCents: 2700 },
        { days: 2, priceCents: 4800 },
        { days: 3, priceCents: 6600 },
        { days: 4, priceCents: 8100 },
        { days: 5, priceCents: 9500 }
      ],
      avulsoPriceCents: 900
    }
  ];

  const subjectsForPackages = await prisma.subject.findMany();

  for (const base of packagesBase) {
    for (const monthly of base.monthly) {
      const displayName = monthly.name ?? `${monthly.days} dia/semana`;

      await createPackage({
        name: `${displayName} - ${base.label}`,
        sessionCount: daysToSessions(monthly.days),
        priceCents: monthly.priceCents,
        subjectId: null,
        billingType: "SUBSCRIPTION",
        billingCycle: "MONTHLY"
      });

      for (const subject of subjectsForPackages) {
        await createPackage({
          name: `${displayName} - ${base.label} - ${subject.name}`,
          sessionCount: daysToSessions(monthly.days),
          priceCents: monthly.priceCents,
          subjectId: subject.id,
          billingType: "SUBSCRIPTION",
          billingCycle: "MONTHLY"
        });
      }
    }

    await createPackage({
      name: `Avulso (50min) - ${base.label}`,
      sessionCount: 1,
      priceCents: base.avulsoPriceCents,
      subjectId: null,
      billingType: "PACKAGE"
    });

    for (const subject of subjectsForPackages) {
      await createPackage({
        name: `Avulso (50min) - ${base.label} - ${subject.name}`,
        sessionCount: 1,
        priceCents: base.avulsoPriceCents,
        subjectId: subject.id,
        billingType: "PACKAGE"
      });
    }
  }

  console.log("Seed completed:", {
    admin: admin.email,
    student: student.email,
    subjects: subjects.length,
    sessions: sessions.length,
    usersImported: importedCount,
    usersSkipped: skippedCount
  });
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function parseRole(raw: string) {
  const value = normalizeKey(raw ?? "");
  if (value === "professor" || value === "prof" || value === "teacher") return Role.PROFESSOR;
  if (value === "admin" || value === "secretaria" || value === "secretario") return Role.ADMIN;
  return Role.ALUNO;
}

function splitDisciplines(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadUsersFromSpreadsheet(filePath: string) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  return rows.map((row) => ({
    nome: String(row.nome ?? "").trim(),
    email: String(row.email ?? "").trim(),
    senha: String(row.senha ?? "").trim(),
    perfil: String(row.perfil ?? "").trim(),
    serie: String(row.serie ?? "").trim(),
    turma: String(row.turma ?? "").trim(),
    unidade: String(row.unidade ?? "").trim(),
    disciplinas: String(row.disciplinas ?? "").trim()
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
