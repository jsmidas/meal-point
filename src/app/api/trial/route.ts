import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLiveSession } from "@/lib/auth/guard";
const TRIAL_DAYS = 7;

// 서명된 세션 쿠키에서 회원 ID 추출 (카카오 등 소셜 로그인 시 { role, id, name })
async function getMemberId(req: NextRequest): Promise<string | null> {
  // 정지·삭제된 회원은 제외 (현재 상태를 DB로 확인)
  const s = await getLiveSession(req);
  return s?.id || null;
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

/**
 * 이 회원이 체험을 이미 사용했는가 (1인 1회).
 * 만료·회수된 사용권이 하나라도 있으면 사용한 것으로 본다.
 * 관리자가 "재체험 허용"을 누르면 지난 사용권이 status='reopened' 로 바뀌어 다시 신청할 수 있다.
 * 조회에 실패하면 새로 발급하지 않도록 "사용함"으로 본다(무제한 재발급 방지).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hasUsedTrial(db: any, memberId: string): Promise<boolean> {
  const { data, error } = await db
    .from("meal_trial_grants")
    .select("id")
    .eq("member_id", memberId)
    .neq("status", "reopened")
    .limit(1);
  if (error) {
    console.error("[trial] 체험 이력 조회 실패", error.message);
    return true;
  }
  return !!data && data.length > 0;
}

// GET — 현재 체험 상태 조회
export async function GET(request: NextRequest) {
  const memberId = await getMemberId(request);
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
  // 진행 중인 사용권이 없는데 지난 사용권이 있으면 이미 체험을 마친 회원이다 (1인 1회)
  if (await hasUsedTrial(db, memberId)) {
    return NextResponse.json({ authenticated: true, status: "used" });
  }
  return NextResponse.json({ authenticated: true, status: "eligible" });
}

// POST — 체험 사용권 발급 (계정 자동 배정)
export async function POST(request: NextRequest) {
  const memberId = await getMemberId(request);
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

  // 1.5) 체험은 1인 1회 — 이미 체험을 마친 회원에게는 새로 발급하지 않는다
  //      (예전에는 만료 다음 날 다시 들어오면 화면이 열리는 것만으로 새 7일이 발급됐다)
  if (await hasUsedTrial(db, memberId)) {
    return NextResponse.json({ ok: true, status: "used" });
  }

  // 2) 비어있는 게스트 계정 1개를 원자적으로 점유 (FOR UPDATE SKIP LOCKED)
  const { data: claimed, error: claimErr } = await db.rpc("claim_guest_account");
  if (claimErr) {
    console.error("[trial] 계정 점유 실패", claimErr.message);
    return NextResponse.json({ ok: false, error: "체험 계정을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  const account = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!account) {
    return NextResponse.json({ ok: true, status: "full" }); // 정원 마감
  }
  const releaseAccount = async () => {
    const { error } = await db.from("meal_guest_accounts").update({ status: "available" }).eq("id", account.id);
    // 실패해도 매일 도는 정리 작업(cron)이 사용권 없는 계정을 다시 풀어 준다
    if (error) console.error("[trial] 계정 반납 실패", { accountId: account.id, message: error.message });
  };

  // 3) 사용권 발급 (7일)
  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: grant, error: grantErr } = await db
    .from("meal_trial_grants")
    .insert({
      member_id: memberId,
      guest_account_id: account.id,
      expires_at: expiresAt,
      status: "active",
    })
    .select("id")
    .single();
  if (grantErr || !grant) {
    // 발급 실패 시 점유 롤백
    await releaseAccount();
    // 같은 회원의 다른 요청이 먼저 발급한 경우(회원당 활성 1건 제약 — schema-v42) 그 사용권을 돌려준다
    const existing = await fetchActiveGrant(db, memberId, nowIso);
    if (existing && existing.meal_guest_accounts) {
      return NextResponse.json({
        ok: true,
        status: "active",
        account: { login_id: existing.meal_guest_accounts.login_id, login_pw: existing.meal_guest_accounts.login_pw },
        expiresAt: existing.expires_at,
      });
    }
    console.error("[trial] 사용권 발급 실패", grantErr?.message);
    return NextResponse.json({ ok: false, error: "체험 사용권을 발급하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  // 4) 동시 요청 정리: 두 탭에서 동시에 신청하면 둘 다 "사용권 없음"으로 보고 각각 발급할 수 있다.
  //    가장 먼저 만들어진 사용권 하나만 남기고, 내 것이 그게 아니면 반납한다.
  const { data: actives } = await db
    .from("meal_trial_grants")
    .select("id, expires_at, meal_guest_accounts(login_id, login_pw)")
    .eq("member_id", memberId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  const winner = actives && actives.length > 0 ? actives[0] : null;
  if (winner && winner.id !== grant.id && winner.meal_guest_accounts) {
    await db.from("meal_trial_grants").delete().eq("id", grant.id);
    await releaseAccount();
    return NextResponse.json({
      ok: true,
      status: "active",
      account: { login_id: winner.meal_guest_accounts.login_id, login_pw: winner.meal_guest_accounts.login_pw },
      expiresAt: winner.expires_at,
    });
  }

  return NextResponse.json({
    ok: true,
    status: "active",
    account: { login_id: account.login_id, login_pw: account.login_pw },
    expiresAt,
  });
}
