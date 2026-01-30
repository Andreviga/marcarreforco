import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { userCreateSchema, userUpdateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

const defaultUnidade = "Colégio Raízes";

export async function GET() {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { studentProfile: true, teacherProfile: { include: { subjects: true } } }
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  let created;
  try {
    created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        role: parsed.data.role,
        studentProfile: parsed.data.role === "ALUNO" ? {
          create: {
            serie: parsed.data.serie ?? "",
            turma: parsed.data.turma ?? "",
            unidade: parsed.data.unidade?.trim() ? parsed.data.unidade : defaultUnidade
          }
        } : undefined,
        teacherProfile: parsed.data.role === "PROFESSOR" ? { create: {} } : undefined
      }
    });
  } catch (error) {
    console.error("CREATE_USER_FAILED", {
      email: parsed.data.email?.toLowerCase(),
      role: parsed.data.role,
      error: error instanceof Error ? error.message : error
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "E-mail já cadastrado" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erro ao criar usuário" }, { status: 500 });
  }

  if (parsed.data.role === "PROFESSOR" && parsed.data.subjectIds?.length) {
    await prisma.teacherSubject.createMany({
      data: parsed.data.subjectIds.map((subjectId) => ({
        teacherId: created.id,
        subjectId
      })),
      skipDuplicates: true
    });
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "CREATE_USER",
    entityType: "User",
    entityId: created.id,
    payload: parsed.data
  });

  return NextResponse.json({ user: created });
}

export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email?.toLowerCase(),
      role: parsed.data.role
    }
  });

  if (parsed.data.role === "ALUNO") {
    await prisma.studentProfile.upsert({
      where: { userId: updated.id },
      update: {
        serie: parsed.data.serie ?? "",
        turma: parsed.data.turma ?? "",
        unidade: parsed.data.unidade?.trim() ? parsed.data.unidade : defaultUnidade
      },
      create: {
        userId: updated.id,
        serie: parsed.data.serie ?? "",
        turma: parsed.data.turma ?? "",
        unidade: parsed.data.unidade?.trim() ? parsed.data.unidade : defaultUnidade
      }
    });
  }

  if (parsed.data.role === "PROFESSOR") {
    await prisma.teacherProfile.upsert({
      where: { userId: updated.id },
      update: {},
      create: { userId: updated.id }
    });

    if (parsed.data.subjectIds) {
      await prisma.teacherSubject.deleteMany({ where: { teacherId: updated.id } });
      if (parsed.data.subjectIds.length) {
        await prisma.teacherSubject.createMany({
          data: parsed.data.subjectIds.map((subjectId) => ({
            teacherId: updated.id,
            subjectId
          }))
        });
      }
    }
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "UPDATE_USER",
    entityType: "User",
    entityId: updated.id,
    payload: parsed.data
  });

  return NextResponse.json({ user: updated });
}
