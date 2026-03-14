import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "mp_admin_token";

function getAuth(request: NextRequest): { authenticated: boolean; role: string } {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return { authenticated: false, role: "" };

  try {
    const parsed = JSON.parse(raw);
    return { authenticated: true, role: parsed.role || "member" };
  } catch {
    // 기존 문자열 토큰 호환
    if (raw === "mealpoint-admin-authenticated") {
      return { authenticated: true, role: "admin" };
    }
    return { authenticated: false, role: "" };
  }
}

export function middleware(request: NextRequest) {
  const { authenticated, role } = getAuth(request);
  const path = request.nextUrl.pathname;

  // /admin 경로 — 관리자만 접근 가능
  if (path.startsWith("/admin")) {
    if (!authenticated || role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // /login, /register — 로그인된 상태면 역할별 리다이렉트
  if (path === "/login" || path === "/register") {
    if (authenticated) {
      const url = request.nextUrl.clone();
      url.pathname = role === "admin" ? "/admin" : "/";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/register"],
};
