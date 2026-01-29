import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const roleMap: Record<string, string[]> = {
  "/aluno": ["ALUNO"],
  "/professor": ["PROFESSOR"],
  "/admin": ["ADMIN"]
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: ["/aluno/:path*", "/professor/:path*", "/admin/:path*"]
};
