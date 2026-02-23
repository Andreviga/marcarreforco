import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { profileDocumentSchema } from "@/lib/validators";
import { isValidDocument } from "@/lib/asaas";

export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ALUNO"]);
  if (response) return response;

  const body = await request.json();
  const parsed = profileDocumentSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.errors[0]?.message || "Dados inválidos";
    return NextResponse.json({ message: errorMessage }, { status: 400 });
  }

  const existing = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { document: true }
  });

  if (!existing) {
    return NextResponse.json({ message: "Complete o onboarding primeiro." }, { status: 400 });
  }

  const cleanedDocument = parsed.data.document.replace(/\D/g, "");

  // Validar formato do documento
  if (!isValidDocument(cleanedDocument)) {
    return NextResponse.json({ message: "CPF ou CNPJ inválido" }, { status: 400 });
  }

  // Se já existe CPF válido, usuário não pode alterar (somente admin)
  if (existing.document) {
    const currentClean = existing.document.replace(/\D/g, "");
    const currentValid = isValidDocument(currentClean);
    
    if (currentValid && currentClean !== cleanedDocument) {
      return NextResponse.json({ 
        message: "CPF/CNPJ validado não pode ser alterado. Contate um administrador." 
      }, { status: 403 });
    }
  }

  // Verificar se CPF/CNPJ já está em uso por outro usuário
  const duplicateDocument = await prisma.studentProfile.findFirst({
    where: {
      document: cleanedDocument,
      userId: { not: session.user.id }
    },
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });

  if (duplicateDocument) {
    return NextResponse.json({ 
      message: `Este CPF/CNPJ já está cadastrado para outro usuário (${duplicateDocument.user.name})` 
    }, { status: 400 });
  }

  const profile = await prisma.studentProfile.update({
    where: { userId: session.user.id },
    data: { document: cleanedDocument }
  });

  return NextResponse.json({ profile });
}
