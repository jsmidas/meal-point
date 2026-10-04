/**
 * 서버(API Route / Server Component)에서 세션을 읽고 권한을 확인하는 헬퍼.
 */
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, type Session } from "./session";
import { isAdminRole } from "./roles";

/** 현재 요청의 세션 (없거나 위조·만료면 null) */
export async function getSession(request?: NextRequest): Promise<Session | null> {
  const raw = request ? request.cookies.get(SESSION_COOKIE)?.value : (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(raw);
}

/** 관리자 세션 (super_admin / admin) 또는 null */
export async function getAdminSession(request?: NextRequest): Promise<Session | null> {
  const s = await getSession(request);
  return s && isAdminRole(s.role) ? s : null;
}

/** 관리자가 아니면 401 응답을 돌려준다. 관리자면 null. */
export async function requireAdmin(request?: NextRequest): Promise<NextResponse | null> {
  const s = await getAdminSession(request);
  if (s) return null;
  return NextResponse.json({ ok: false, data: null, error: "관리자 권한이 필요합니다." }, { status: 401 });
}
