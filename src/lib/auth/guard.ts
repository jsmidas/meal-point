/**
 * 서버(API Route / Server Component)에서 세션을 읽고 권한을 확인하는 헬퍼.
 *
 * 쿠키 서명·만료 확인(getSession)에 더해, 권한이 필요한 곳(getLiveSession 계열)에서는
 * 회원의 "현재" 상태를 DB에서 다시 확인한다. 쿠키는 7일간 유효하므로, 이 확인이 없으면
 * 계정을 정지·삭제하거나 권한을 내려도 기존 로그인으로 계속 접근할 수 있다.
 */
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, verifySession, type Session } from "./session";
import { isAdminRole, memberSessionRole } from "./roles";

/** 현재 요청의 세션 (없거나 위조·만료면 null). 쿠키만 확인한다. */
export async function getSession(request?: NextRequest): Promise<Session | null> {
  const raw = request ? request.cookies.get(SESSION_COOKIE)?.value : (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(raw);
}

// ── 회원 현재 상태 확인 ──
// 관리자 화면은 요청이 잦으므로(목록 조회마다 프록시 호출) 짧게 캐시한다.
// 정지·권한 변경은 늦어도 이 시간 안에 반영된다.
const LIVE_TTL_MS = 30_000;
type LiveMember = { is_active: boolean; role: string | null; company_id: string | null } | null;
const liveCache = new Map<string, { at: number; member: LiveMember }>();

async function loadLiveMember(memberId: string): Promise<{ ok: true; member: LiveMember } | { ok: false }> {
  const hit = liveCache.get(memberId);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return { ok: true, member: hit.member };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (createAdminClient().from("members") as any)
      .select("is_active, role, company_id")
      .eq("id", memberId)
      .maybeSingle();
    if (error) {
      console.error("[auth/guard] 회원 상태 조회 실패", error.message);
      return { ok: false };
    }
    const member: LiveMember = data
      ? { is_active: !!data.is_active, role: data.role ?? null, company_id: data.company_id ?? null }
      : null;
    if (liveCache.size > 500) liveCache.clear();
    liveCache.set(memberId, { at: Date.now(), member });
    return { ok: true, member };
  } catch (err) {
    console.error("[auth/guard] 회원 상태 조회 예외", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

/**
 * 쿠키 세션을 DB의 현재 회원 상태와 대조한다.
 * - 환경변수 관리자(세션에 id 없음)는 DB 회원이 아니므로 그대로 통과
 * - 회원이 삭제됐거나 정지됐으면 null
 * - 세션의 역할·거래처가 현재 상태와 다르면 null (권한 회수, 거래처 변경 등)
 * - DB 조회 자체가 실패하면 쿠키 세션을 그대로 인정한다(일시 장애로 전원이 튕기는 것을 막기 위함)
 */
export async function getLiveSession(request?: NextRequest): Promise<Session | null> {
  const s = await getSession(request);
  if (!s) return null;
  if (!s.id) return s;

  const live = await loadLiveMember(s.id);
  if (!live.ok) return s;
  const m = live.member;
  if (!m || !m.is_active) return null;

  const role = memberSessionRole(m);
  if (isAdminRole(s.role)) return role === "admin" ? s : null;
  if (s.role === "company") {
    return role === "company" && m.company_id === (s.company_id || null) ? s : null;
  }
  return s; // 일반 회원: 활성 상태면 통과
}

/** 관리자 세션 (super_admin / admin) 또는 null — 현재 권한을 DB로 확인한다. */
export async function getAdminSession(request?: NextRequest): Promise<Session | null> {
  const s = await getLiveSession(request);
  return s && isAdminRole(s.role) ? s : null;
}

/** 관리자가 아니면 401 응답을 돌려준다. 관리자면 null. */
export async function requireAdmin(request?: NextRequest): Promise<NextResponse | null> {
  const s = await getAdminSession(request);
  if (s) return null;
  return NextResponse.json({ ok: false, data: null, error: "관리자 권한이 필요합니다." }, { status: 401 });
}
