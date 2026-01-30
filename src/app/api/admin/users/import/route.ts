import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { userCreateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

const defaultUnidade = "Colégio Raízes";

const importSchema = z.object({
  users: z.array(z.unknown())
});

const userImportSchema = userCreateSchema.extend({
  _rowNumber: z.number().int().positive().optional()
});

export async function POST(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const createdUsers: string[] = [];
  const skippedExisting: string[] = [];
  const duplicateInFile: string[] = [];
  const invalidRows: string[] = [];
  const errors: string[] = [];

  const normalizedEmails = new Set<string>();

  for (const rawUser of parsed.data.users) {
    const parsedUser = userImportSchema.safeParse(rawUser);
    if (!parsedUser.success) {
      const rowNumber =
        typeof rawUser === "object" && rawUser && "_rowNumber" in rawUser
          ? (rawUser as { _rowNumber?: number })._rowNumber
          : undefined;
      invalidRows.push(`Linha ${rowNumber ?? "?"}: dados inválidos`);
      continue;
    }

    const user = parsedUser.data;
    const email = user.email.toLowerCase();
    if (normalizedEmails.has(email)) {
      duplicateInFile.push(`Linha ${user._rowNumber ?? "?"}: ${email}`);
      continue;
    }
    normalizedEmails.add(email);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      skippedExisting.push(email);
      continue;
    }

    try {
      const passwordHash = await bcrypt.hash(user.password, 10);
      const created = await prisma.user.create({
        data: {
          name: user.name,
          email,
          passwordHash,
          role: user.role,
          studentProfile: user.role === "ALUNO" ? {
            create: {
              serie: user.serie ?? "",
              turma: user.turma ?? "",
              unidade: user.unidade?.trim() ? user.unidade : defaultUnidade
            }
          } : undefined,
          teacherProfile: user.role === "PROFESSOR" ? { create: {} } : undefined
        }
      });

      if (user.role === "PROFESSOR" && user.subjectIds?.length) {
        await prisma.teacherSubject.createMany({
          data: user.subjectIds.map((subjectId) => ({
            teacherId: created.id,
            subjectId
          })),
          skipDuplicates: true
        });
      }

      await logAudit({
        actorUserId: session.user.id,
        action: "IMPORT_USER",
        entityType: "User",
        entityId: created.id,
        payload: user
      });

      createdUsers.push(email);
    } catch (error) {
      errors.push(`${email}: ${(error as Error).message}`);
    }
  }

  return NextResponse.json({
    created: createdUsers.length,
    skippedExisting: skippedExisting.length,
    duplicateInFile: duplicateInFile.length,
    invalidRows: invalidRows.length,
    details: {
      skippedExisting,
      duplicateInFile,
      invalidRows,
      errors
    }
  });
}
