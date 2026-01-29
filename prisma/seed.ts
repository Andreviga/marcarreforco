import { PrismaClient, Role, Modality, SessionStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { addDays, setHours, setMinutes, startOfWeek } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

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

  const teacher = await prisma.user.upsert({
    where: { email: "professor@colegio.com" },
    update: {},
    create: {
      name: "Prof. Marcos",
      email: "professor@colegio.com",
      passwordHash,
      role: Role.PROFESSOR,
      teacherProfile: { create: {} }
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
          turma: "B",
          unidade: "Unidade Centro"
        }
      }
    }
  });

  const math = await prisma.subject.upsert({
    where: { name: "Matemática" },
    update: {},
    create: { name: "Matemática", defaultPriceCents: 5000 }
  });

  const portuguese = await prisma.subject.upsert({
    where: { name: "Português" },
    update: {},
    create: { name: "Português", defaultPriceCents: 4500 }
  });

  await prisma.teacherSubject.createMany({
    data: [
      { teacherId: teacher.id, subjectId: math.id },
      { teacherId: teacher.id, subjectId: portuguese.id }
    ],
    skipDuplicates: true
  });

  const baseWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const sessions = [
    {
      subjectId: math.id,
      teacherId: teacher.id,
      startsAt: setMinutes(setHours(addDays(baseWeek, 1), 14), 0),
      endsAt: setMinutes(setHours(addDays(baseWeek, 1), 15), 30),
      location: "Sala 12",
      modality: Modality.PRESENCIAL,
      priceCents: 5000,
      status: SessionStatus.ATIVA
    },
    {
      subjectId: math.id,
      teacherId: teacher.id,
      startsAt: setMinutes(setHours(addDays(baseWeek, 3), 14), 0),
      endsAt: setMinutes(setHours(addDays(baseWeek, 3), 15), 30),
      location: "Sala 12",
      modality: Modality.PRESENCIAL,
      priceCents: 5000,
      status: SessionStatus.ATIVA
    },
    {
      subjectId: portuguese.id,
      teacherId: teacher.id,
      startsAt: setMinutes(setHours(addDays(baseWeek, 2), 10), 0),
      endsAt: setMinutes(setHours(addDays(baseWeek, 2), 11), 30),
      location: "Online",
      modality: Modality.ONLINE,
      priceCents: 4500,
      status: SessionStatus.ATIVA
    },
    {
      subjectId: portuguese.id,
      teacherId: teacher.id,
      startsAt: setMinutes(setHours(addDays(baseWeek, 4), 10), 0),
      endsAt: setMinutes(setHours(addDays(baseWeek, 4), 11), 30),
      location: "Sala 9",
      modality: Modality.PRESENCIAL,
      priceCents: 4500,
      status: SessionStatus.ATIVA
    }
  ];

  for (const session of sessions) {
    await prisma.session.create({ data: session });
  }

  console.log("Seed completed:", { admin: admin.email, teacher: teacher.email, student: student.email });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
