import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import bcrypt from "bcrypt";
import { isValidDocument } from "@/lib/asaas";

// GET /api/profile - Buscar dados do perfil do usuário logado
export async function GET() {
  const { session, response } = await requireApiRole(["ALUNO", "PROFESSOR", "ADMIN"]);
  if (response) return response;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      studentProfile: {
        select: {
          serie: true,
          turma: true,
          unidade: true,
          document: true
        }
      },
      teacherProfile: {
        select: {
          subjects: {
            select: {
              subject: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

// PATCH /api/profile - Atualizar dados do perfil
export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO", "PROFESSOR", "ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const { name, email, currentPassword, newPassword, serie, turma, unidade, document, subjectIds } = body;

  // Validações básicas
  if (name && (typeof name !== "string" || name.trim().length === 0)) {
    return NextResponse.json({ message: "Nome inválido" }, { status: 400 });
  }

  if (email && (typeof email !== "string" || !email.includes("@"))) {
    return NextResponse.json({ message: "Email inválido" }, { status: 400 });
  }

  // Se vai alterar senha, precisa confirmar a senha atual
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ message: "Informe a senha atual para alterá-la" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ message: "Senha atual incorreta" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ message: "Nova senha deve ter no mínimo 6 caracteres" }, { status: 400 });
    }
  }

  // Validar CPF/CNPJ se fornecido
  if (document && !isValidDocument(document)) {
    return NextResponse.json({ message: "CPF ou CNPJ inválido" }, { status: 400 });
  }

  // Verificar se email já está em uso por outro usuário
  if (email && email !== session.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ message: "Email já cadastrado" }, { status: 400 });
    }
  }

  // Atualizar dados do usuário
  const updateData: any = {};
  if (name) updateData.name = name.trim();
  if (email) updateData.email = email.toLowerCase().trim();
  if (newPassword) updateData.passwordHash = await bcrypt.hash(newPassword, 10);

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData
  });

  // Atualizar perfil específico por role
  if (session.user.role === "ALUNO") {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id }
    });

    if (studentProfile) {
      const studentData: any = {};
      if (serie !== undefined) studentData.serie = serie || null;
      if (turma !== undefined) studentData.turma = turma || null;
      if (unidade !== undefined) studentData.unidade = unidade || null;
      if (document !== undefined) studentData.document = document || null;

      if (Object.keys(studentData).length > 0) {
        await prisma.studentProfile.update({
          where: { userId: session.user.id },
          data: studentData
        });
      }
    }
  }

  if (session.user.role === "PROFESSOR") {
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id }
    });

    if (teacherProfile && subjectIds && Array.isArray(subjectIds)) {
      // Remover todas as disciplinas atuais
      await prisma.teacherSubject.deleteMany({
        where: { teacherId: session.user.id }
      });

      // Adicionar as novas disciplinas
      if (subjectIds.length > 0) {
        await prisma.teacherSubject.createMany({
          data: subjectIds.map((subjectId: string) => ({
            teacherId: session.user.id,
            subjectId
          }))
        });
      }
    }
  }

  return NextResponse.json({ 
    message: "Perfil atualizado com sucesso",
    user: updatedUser
  });
}
