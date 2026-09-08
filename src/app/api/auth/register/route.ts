import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serieSchema, turmaSchema, unidadeSchema } from "@/lib/validators";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const defaultUnidade = "Colégio Raízes";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  accessCode: z.string().min(1),
  serie: serieSchema,
  turma: turmaSchema,
  unidade: unidadeSchema
});

export async function POST(request: Request) {
  if (!rateLimit(`register:${clientIp(request)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ message: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
  }
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    // Devolve o motivo real (ex.: "Série não atendida pelo plantão") em vez
    // de um genérico que deixa o aluno sem saber o que corrigir.
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { message: firstIssue?.message && firstIssue.message !== "Required" ? firstIssue.message : "Dados inválidos" },
      { status: 400 }
    );
  }

  const accessCode = process.env.REGISTER_ACCESS_CODE ?? "222";
  if (parsed.data.accessCode !== accessCode) {
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
          unidade: parsed.data.unidade?.trim() ? parsed.data.unidade : defaultUnidade
        }
      }
    }
  });

  return NextResponse.json({ userId: created.id });
}
