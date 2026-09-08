import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const MAX_TOKEN_ATTEMPTS = 5;

const requestSchema = z.object({
  email: z.string().email()
});

const confirmSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  token: z.string().min(4)
});

const allowlist = (process.env.ADMIN_ALLOWED_EMAILS ?? "contato@raizesedu.com.br,coordenadoria@raizesedu.com.br")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export async function PUT(request: Request) {
  if (!rateLimit(`bootstrap-put:${clientIp(request)}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ message: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
  }
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  if (!allowlist.includes(email)) {
    return NextResponse.json({ message: "E-mail não autorizado" }, { status: 403 });
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) {
    return NextResponse.json({ message: "Admin já cadastrado" }, { status: 409 });
  }

  const token = crypto.randomInt(100000, 999999).toString();
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.adminBootstrapToken.create({
    data: {
      email,
      tokenHash,
      expiresAt
    }
  });

  await sendEmail({
    to: email,
    subject: "Seu código de acesso (Admin)",
    html: `<p>Seu código de verificação é <strong>${token}</strong>.</p><p>Ele expira em 15 minutos.</p>`
  });

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!rateLimit(`bootstrap-post:${clientIp(request)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ message: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
  }
  const body = await request.json();
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  if (!allowlist.includes(email)) {
    return NextResponse.json({ message: "E-mail não autorizado" }, { status: 403 });
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) {
    return NextResponse.json({ message: "Admin já cadastrado" }, { status: 409 });
  }

  const latestToken = await prisma.adminBootstrapToken.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: "desc" }
  });

  if (!latestToken) {
    return NextResponse.json({ message: "Token inválido" }, { status: 403 });
  }

  if (latestToken.expiresAt < new Date()) {
    return NextResponse.json({ message: "Token expirado" }, { status: 403 });
  }

  // Token de 6 dígitos: após N erros, invalida — força bruta fica inviável.
  if (latestToken.attempts >= MAX_TOKEN_ATTEMPTS) {
    return NextResponse.json({ message: "Token bloqueado. Solicite um novo código." }, { status: 403 });
  }

  const isValid = await bcrypt.compare(parsed.data.token, latestToken.tokenHash);
  if (!isValid) {
    await prisma.adminBootstrapToken.update({
      where: { id: latestToken.id },
      data: { attempts: { increment: 1 } }
    });
    return NextResponse.json({ message: "Token inválido" }, { status: 403 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ message: "E-mail já cadastrado" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: "ADMIN"
    }
  });

  await prisma.adminBootstrapToken.update({
    where: { id: latestToken.id },
    data: { usedAt: new Date() }
  });

  return NextResponse.json({ userId: created.id });
}
