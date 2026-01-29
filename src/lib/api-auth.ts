import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireApiRole(roles: string[]) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, response: NextResponse.json({ message: "Não autenticado" }, { status: 401 }) };
  }
  if (!roles.includes(session.user.role)) {
    return { session: null, response: NextResponse.json({ message: "Sem permissão" }, { status: 403 }) };
  }
  return { session, response: null };
}
