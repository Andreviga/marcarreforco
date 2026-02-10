import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/api-auth";
import { ticketStatusSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  const body = await request.json();
  const parsed = ticketStatusSchema.safeParse({ ...body, id: context.params.id });
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const updated = await prisma.ticket.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status }
  });

  return NextResponse.json({ ticket: updated });
}
