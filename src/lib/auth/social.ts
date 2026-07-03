import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "mp_admin_token";

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

export function createAuthResponse(
  member: { id: string; name: string },
  redirectUrl: string
) {
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(
    COOKIE_NAME,
    JSON.stringify({ role: "member", id: member.id, name: member.name }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    }
  );
  return response;
}
