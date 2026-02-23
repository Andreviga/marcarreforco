import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { profileDocumentSchema } from "@/lib/validators";

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
    where: { userId: session.user.id }
  });

  if (!existing) {
    return NextResponse.json({ message: "Complete o onboarding primeiro." }, { status: 400 });
  }

  const profile = await prisma.studentProfile.update({
    where: { userId: session.user.id },
    data: { document: parsed.data.document }
  });

  return NextResponse.json({ profile });
}
