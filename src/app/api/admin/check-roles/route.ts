import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";

// GET /api/admin/check-roles - Listar todos os usuários e suas roles
export async function GET() {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    },
    orderBy: [{ role: "asc" }, { email: "asc" }]
  });

  const summary = {
    total: users.length,
    byRole: {
      ADMIN: users.filter(u => u.role === "ADMIN").length,
      PROFESSOR: users.filter(u => u.role === "PROFESSOR").length,
      ALUNO: users.filter(u => u.role === "ALUNO").length
    }
  };

  return NextResponse.json({ users, summary });
}

// PATCH /api/admin/check-roles - Atualizar role de um usuário
export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const { userId, newRole } = body;

  if (!userId || !newRole) {
    return NextResponse.json(
      { message: "userId e newRole são obrigatórios" },
      { status: 400 }
    );
  }

  if (!["ADMIN", "PROFESSOR", "ALUNO"].includes(newRole)) {
    return NextResponse.json(
      { message: "newRole deve ser ADMIN, PROFESSOR ou ALUNO" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  // Log de auditoria
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: "UPDATE_USER_ROLE",
      entityType: "User",
      entityId: userId,
      payloadJson: {
        newRole,
        updatedBy: session.user.email
      }
    }
  });

  return NextResponse.json({
    message: "Role atualizada com sucesso",
    user
  });
}
