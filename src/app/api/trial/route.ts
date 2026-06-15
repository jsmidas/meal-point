import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "mp_admin_token";
const TRIAL_DAYS = 7;

// 로그인 쿠키에서 회원 ID 추출 (카카오 등 소셜 로그인 시 { role, id, name })
function getMemberId(req: NextRequest): string | null {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.id || null;
  } catch {
    return null;
  }
}

// 회원의 유효한(만료 전) 활성 사용권 + 배정 계정 조회
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchActiveGrant(db: any, memberId: string, nowIso: string) {
  const { data } = await db
    .from("meal_trial_grants")
    .select("id, expires_at, guest_account_id, meal_guest_accounts(login_id, login_pw)")
    .eq("member_id", memberId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// GET — 현재 체험 상태 조회
export async function GET(request: NextRequest) {
  const memberId = getMemberId(request);
  if (!memberId) {
    return NextResponse.json({ authenticated: false });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const grant = await fetchActiveGrant(db, memberId, new Date().toISOString());
  if (grant && grant.meal_guest_accounts) {
    return NextResponse.json({
      authenticated: true,
      status: "active",
      account: { login_id: grant.meal_guest_accounts.login_id, login_pw: grant.meal_guest_accounts.login_pw },
      expiresAt: grant.expires_at,
    });
  }
  return NextResponse.json({ authenticated: true, status: "eligible" });
}

// POST — 체험 사용권 발급 (계정 자동 배정)
export async function POST(request: NextRequest) {
  const memberId = getMemberId(request);
  if (!memberId) {
    return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const nowIso = new Date().toISOString();

  // 1) 이미 유효한 사용권이 있으면 그대로 반환 (재방문 — 부담 없는 재진입)
  const active = await fetchActiveGrant(db, memberId, nowIso);
  if (active && active.meal_guest_accounts) {
    return NextResponse.json({
      ok: true,
      status: "active",
      account: { login_id: active.meal_guest_accounts.login_id, login_pw: active.meal_guest_accounts.login_pw },
      expiresAt: active.expires_at,
    });
  }

  // 2) 비어있는 게스트 계정 1개를 원자적으로 점유 (FOR UPDATE SKIP LOCKED)
  const { data: claimed, error: claimErr } = await db.rpc("claim_guest_account");
  if (claimErr) {
    return NextResponse.json({ ok: false, error: claimErr.message }, { status: 500 });
  }
  const account = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!account) {
    return NextResponse.json({ ok: true, status: "full" }); // 정원 마감
  }

  // 3) 사용권 발급 (7일)
  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: grantErr } = await db.from("meal_trial_grants").insert({
    member_id: memberId,
    guest_account_id: account.id,
    expires_at: expiresAt,
    status: "active",
  });
  if (grantErr) {
    // 발급 실패 시 점유 롤백
    await db.from("meal_guest_accounts").update({ status: "available" }).eq("id", account.id);
    return NextResponse.json({ ok: false, error: grantErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: "active",
    account: { login_id: account.login_id, login_pw: account.login_pw },
    expiresAt,
  });
}
