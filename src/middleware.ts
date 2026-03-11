import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "mp_admin_token";
const TOKEN_VALUE = "mealpoint-admin-authenticated";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = token === TOKEN_VALUE;

  // /admin 경로 보호 — 미인증 시 로그인 페이지로
  if (!isAuthenticated && request.nextUrl.pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 로그인된 상태에서 /login 접근 시 admin으로
  if (isAuthenticated && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
