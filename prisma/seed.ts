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

  console.log("Seed completed:", { admin: admin.email, student: student.email, subjects: subjects.length, sessions: sessions.length });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
