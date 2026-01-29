import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  accessCode: z.string().min(1),
  serie: z.string().optional(),
  turma: z.string().optional(),
  unidade: z.string().optional()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  if (parsed.data.accessCode !== "222") {
    return NextResponse.json({ message: "Código inválido" }, { status: 403 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: "E-mail já cadastrado" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: "ALUNO",
      studentProfile: {
        create: {
          serie: parsed.data.serie ?? "",
          turma: parsed.data.turma ?? "",
          unidade: parsed.data.unidade ?? ""
        }
      }
    }
  });

  return NextResponse.json({ userId: created.id });
}
