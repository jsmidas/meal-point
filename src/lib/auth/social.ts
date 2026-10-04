import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, signSession, sessionCookieOptions } from "@/lib/auth/session";

export async function findOrCreateMember(profile: {
  provider: string;
  provider_id: string;
  name: string;
  email?: string | null;
}) {
  // service_role 필수: members 는 RLS 로 anon INSERT 가 막혀 있어(schema-v21)
  // anon 클라이언트로는 신규 회원 등록이 조용히 실패한다 — 카카오 첫 로그인이
  // error=inactive 로 튕기던 원인. 이 모듈은 서버 전용(auth 라우트)이라 안전.
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase.from("members") as any;

  // 기존 회원 찾기
  const { data: existing } = await db
    .select("id, name, is_active")
    .eq("provider", profile.provider)
    .eq("provider_id", profile.provider_id)
    .maybeSingle();

  if (existing) {
    if (!existing.is_active) return null;
    return existing;
  }

  // 신규 회원 자동 등록
  const { data: newMember } = await db
    .insert({
      name: profile.name,
      email: profile.email || null,
      provider: profile.provider,
      provider_id: profile.provider_id,
    })
    .select("id, name")
    .single();

  return newMember;
}

export async function createAuthResponse(
  member: { id: string; name: string },
  redirectUrl: string
) {
  const response = NextResponse.redirect(redirectUrl);
  const token = await signSession({ role: "member", id: member.id, name: member.name });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  response.cookies.set("mp_admin_token", "", { path: "/", maxAge: 0 });
  return response;
}
