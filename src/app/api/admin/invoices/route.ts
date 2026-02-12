import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api-auth";

export async function GET(request: Request) {
  const { response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  return NextResponse.json(
    { message: "Fechamento desativado. Utilize pagamentos via Asaas." },
    { status: 410 }
  );
}

export async function PATCH(request: Request) {
  const { session, response } = await requireApiRole(["ADMIN"]);
  if (response) return response;

  return NextResponse.json(
    { message: "Fechamento desativado. Utilize pagamentos via Asaas." },
    { status: 410 }
  );
}
