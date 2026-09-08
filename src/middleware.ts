import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const roleMap: Record<string, string[]> = {
  "/aluno": ["ALUNO"],
  "/professor": ["PROFESSOR"],
  "/admin": ["ADMIN"]
};

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Anti-CSRF: o cookie de sessão usa SameSite=None, então um site malicioso
  // conseguiria disparar requisições autenticadas. Requisições de navegador
  // enviam Origin em métodos mutantes; se vier de outra origem, recusa.
  // Chamadas servidor-a-servidor (webhook do Asaas, cron) não têm Origin.
  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      // x-forwarded-host pode vir multi-valor em cadeia de proxies ("a, b").
      const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))
        ?.split(",")[0]
        ?.trim();
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      if (!host || originHost !== host) {
        return NextResponse.json({ message: "Origem não permitida" }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  const protectedPrefix = Object.keys(roleMap).find((prefix) => pathname.startsWith(prefix));
  if (!protectedPrefix) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.role) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const allowedRoles = roleMap[protectedPrefix] ?? [];
  if (!allowedRoles.includes(token.role as string)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/aluno/:path*", "/professor/:path*", "/admin/:path*", "/api/:path*"]
};
