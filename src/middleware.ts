import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "mp_admin_token";

function getAuth(request: NextRequest): {
  authenticated: boolean;
  role: string;
  companyId: string | null;
} {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return { authenticated: false, role: "", companyId: null };

  try {
    const parsed = JSON.parse(raw);
    return {
      authenticated: true,
      role: parsed.role || "member",
      companyId: parsed.company_id || null,
    };
  } catch {
    // 기존 문자열 토큰 호환
    if (raw === "mealpoint-admin-authenticated") {
      return { authenticated: true, role: "admin", companyId: null };
    }
    return { authenticated: false, role: "", companyId: null };
  }
}

/** 역할별 기본 진입 경로 */
function homeForRole(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "company") return "/portal";
  return "/";
}

export function middleware(request: NextRequest) {
  const { authenticated, role, companyId } = getAuth(request);
  const path = request.nextUrl.pathname;

  // /admin 경로 — 관리자만 접근 가능
  if (path.startsWith("/admin")) {
    if (!authenticated || role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // /portal 경로 — 거래처 발주 계정(company)만 접근 가능
  if (path.startsWith("/portal")) {
    if (!authenticated || role !== "company" || !companyId) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // /login, /register — 로그인된 상태면 역할별 리다이렉트
  if (path === "/login" || path === "/register") {
    if (authenticated) {
      const url = request.nextUrl.clone();
      url.pathname = homeForRole(role);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/login", "/register"],
};
