import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, signSession, sessionCookieOptions } from "@/lib/auth/session";
import { memberSessionRole } from "@/lib/auth/roles";
import { safeNextOr } from "@/lib/auth/safe-next";

export interface SocialMember {
  id: string;
  name: string;
  role?: string | null;
  company_id?: string | null;
  company_name?: string | null;
}

export type SocialMemberResult =
  | { status: "ok"; member: SocialMember }
  | { status: "inactive" } // 사용이 중지된 계정
  | { status: "error" }; // 프로필 값 이상·DB 오류 등 — "정지된 계정"으로 잘못 안내하지 않도록 구분

const MEMBER_SELECT = "id, name, is_active, role, company_id, companies(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMember(row: any): SocialMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? null,
    company_id: row.company_id ?? null,
    company_name: row.companies?.name ?? null,
  };
}

/**
 * 소셜 계정(provider + provider_id)으로 회원을 찾고, 없으면 새로 등록한다.
 * 이메일로는 계정을 합치지 않는다(다른 제공자·아이디 계정과의 이메일 충돌로 인한 탈취 방지).
 */
export async function findOrCreateMember(profile: {
  provider: string;
  provider_id: string | number | null | undefined;
  name: string;
  email?: string | null;
}): Promise<SocialMemberResult> {
  // 제공자 응답이 비정상이면 id 가 비거나 "undefined" 문자열이 된다.
  // 그 값으로 회원을 만들면 같은 실패를 겪는 사람들이 한 계정을 공유하게 되므로 반드시 거부한다.
  const providerId = profile.provider_id == null ? "" : String(profile.provider_id).trim();
  if (!providerId || providerId === "undefined" || providerId === "null" || providerId.length > 128) {
    console.error(`[social] ${profile.provider} 프로필에 사용자 식별값이 없습니다.`);
    return { status: "error" };
  }

  // service_role 필수: members 는 RLS 로 anon INSERT 가 막혀 있어(schema-v21)
  // anon 클라이언트로는 신규 회원 등록이 조용히 실패한다. 이 모듈은 서버 전용(auth 라우트)이라 안전.
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = () => supabase.from("members") as any;

  const find = () =>
    members().select(MEMBER_SELECT).eq("provider", profile.provider).eq("provider_id", providerId).maybeSingle();

  // 기존 회원 찾기
  const { data: existing, error: findError } = await find();
  if (findError) {
    // 조회가 실패했는데 신규 등록으로 넘어가면 중복 계정이 생긴다 → 중단
    console.error("[social] 회원 조회 실패", findError.message);
    return { status: "error" };
  }
  if (existing) {
    return existing.is_active ? { status: "ok", member: toMember(existing) } : { status: "inactive" };
  }

  // 신규 회원 자동 등록
  const { data: created, error: insertError } = await members()
    .insert({
      name: (profile.name || "회원").slice(0, 100),
      email: profile.email || null,
      provider: profile.provider,
      provider_id: providerId,
    })
    .select(MEMBER_SELECT)
    .single();
  if (created) return { status: "ok", member: toMember(created) };

  // 같은 사람이 동시에 두 번 로그인하면 한쪽은 중복(23505)으로 실패한다 → 방금 만들어진 계정을 다시 찾는다
  if (insertError?.code === "23505") {
    const { data: again } = await find();
    if (again) return again.is_active ? { status: "ok", member: toMember(again) } : { status: "inactive" };
  }
  console.error("[social] 회원 등록 실패", insertError?.message);
  return { status: "error" };
}

/** 로그인 세션 쿠키를 심고 redirectUrl 로 보낸다. 승인된 발주 계정이면 처음부터 그 역할로 발급한다. */
export async function createAuthResponse(member: SocialMember, redirectUrl: string) {
  const response = NextResponse.redirect(redirectUrl);
  const role = memberSessionRole(member);
  const token = await signSession({
    role,
    id: member.id,
    name: member.name,
    company_id: member.company_id || null,
    company_name: member.company_name || null,
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  response.cookies.set("mp_admin_token", "", { path: "/", maxAge: 0 });
  return response;
}

// ── OAuth 시작·콜백 공통 처리 (네이버·카카오·구글이 같은 규칙을 쓰도록) ──

export const OAUTH_NEXT_COOKIE = "oauth_next";
const OAUTH_COOKIE_MAX_AGE = 60 * 10;

function oauthCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** 이 사이트의 기준 주소(콜백 URL 생성용) */
export function oauthBaseUrl(request: NextRequest): string {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

/**
 * 제공자 인증 화면으로 보내는 응답을 만든다.
 * state 쿠키를 심고, ?next= 가 안전한 내부 경로면 보존한다(없으면 이전 시도의 값이 남지 않게 지운다).
 */
export function startOAuthRedirect(request: NextRequest, authUrl: URL, stateCookie: string, state: string) {
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(stateCookie, state, oauthCookieOptions(OAUTH_COOKIE_MAX_AGE));
  const nextPath = safeNextOr(new URL(request.url).searchParams.get("next"));
  response.cookies.set(
    OAUTH_NEXT_COOKIE,
    nextPath === "/" ? "" : nextPath,
    oauthCookieOptions(nextPath === "/" ? 0 : OAUTH_COOKIE_MAX_AGE),
  );
  return response;
}

/** 콜백에서 쓸 복귀 경로 (검증된 내부 경로, 없으면 "/") */
export function oauthNextPath(request: NextRequest): string {
  return safeNextOr(request.cookies.get(OAUTH_NEXT_COOKIE)?.value);
}

function clearOAuthCookies(response: NextResponse, stateCookie: string) {
  response.cookies.set(stateCookie, "", { path: "/", maxAge: 0 });
  response.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * 로그인 실패 시 오류 안내 화면으로 보낸다(임시 쿠키 정리 포함).
 * 기본은 /login. 체험 신청(/trial)에서 시작한 경우에는 그 화면이 오류를 직접 안내하므로 그리로 돌려보낸다
 * — /login 으로 보내면 이미 관리자로 로그인된 사용자는 관리자 화면으로 튕겨 혼란스럽다.
 */
export function oauthErrorRedirect(request: NextRequest, stateCookie: string, code: string) {
  const next = oauthNextPath(request);
  const target = new URL(next === "/trial" || next.startsWith("/trial?") ? "/trial" : "/login", request.url);
  target.searchParams.set("error", code);
  const response = NextResponse.redirect(target);
  clearOAuthCookies(response, stateCookie);
  return response;
}

/** 로그인 성공: 세션을 발급하고 복귀 경로로 보낸다(임시 쿠키 정리 포함). */
export async function oauthSuccessRedirect(request: NextRequest, stateCookie: string, member: SocialMember) {
  const response = await createAuthResponse(member, new URL(oauthNextPath(request), request.url).toString());
  clearOAuthCookies(response, stateCookie);
  return response;
}
