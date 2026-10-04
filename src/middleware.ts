import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { homeForRole, isAdminRole } from "@/lib/auth/roles";

export async function middleware(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const path = request.nextUrl.pathname;

  // /admin — 관리자(super_admin / admin)만
  if (path.startsWith("/admin")) {
    if (!session || !isAdminRole(session.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      const res = NextResponse.redirect(url);
      // 위조·만료 쿠키는 정리
      if (request.cookies.has(SESSION_COOKIE)) res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
  }

  // /portal — 거래처 발주 계정(company)만
  if (path.startsWith("/portal")) {
    if (!session || session.role !== "company" || !session.company_id) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // /account — 로그인한 회원(업체 승인 요청·내 정보). 관리자 계정은 대상이 아니므로 관리자 화면으로
  if (path === "/account") {
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?next=/account";
      return NextResponse.redirect(url);
    }
    if (isAdminRole(session.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // /login, /register — 이미 로그인된 상태면 역할별 진입 경로로
  if (path === "/login" || path === "/register") {
    if (session) {
      const url = request.nextUrl.clone();
      url.pathname = homeForRole(session.role);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();
  if (path.startsWith("/admin") || path.startsWith("/portal")) {
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "same-origin");
  }
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/account", "/login", "/register"],
};
