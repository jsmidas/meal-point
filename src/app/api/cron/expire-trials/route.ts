import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSellPrices } from "@/lib/price-schedule";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET || "";

// 만료된 체험 사용권을 정리하고 게스트 계정을 풀로 회수한다.
// Vercel Cron이 매일 호출하며, Authorization: Bearer <CRON_SECRET> 헤더로 인증된다.
//
// 순서가 중요하다: 계정을 먼저 풀어 주고, 그게 성공한 뒤에 사용권을 만료 처리한다.
// 반대로 하면 계정 해제가 실패했을 때 사용권은 이미 expired 라 다음 실행에서 다시 잡히지 않아
// 계정이 영영 "배정됨"으로 남는다. 이 순서면 실패해도 다음 실행에서 다시 시도된다.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const nowIso = new Date().toISOString();
  const fail = (step: string, message: string) => {
    console.error(`[cron/expire-trials] ${step} 실패`, message);
    return NextResponse.json({ ok: false, step, error: message }, { status: 500 });
  };

  // 0) 적용일이 된 예약 판매 단가를 "지금 적용 중인 단가"에 반영한다.
  //    이 작업은 매일 한국시간 자정에 돌기 때문에, 적용일 0시부터 새 단가가 쓰인다.
  //    체험 계정 정리와는 별개 작업이라, 여기서 실패해도 아래 정리는 계속 진행한다.
  let prices: { checked: number; changed: number; errors: number } | null = null;
  try {
    const r = await syncSellPrices(db);
    prices = { checked: r.checked, changed: r.changed, errors: r.errors.length };
    if (r.errors.length > 0) console.error("[cron] 예약 단가 반영 오류", r.errors.slice(0, 3));
  } catch (err) {
    console.error("[cron] 예약 단가 반영 실패", err instanceof Error ? err.message : err);
  }

  // 1) 만료된 활성 사용권
  const { data: expired, error: expiredError } = await db
    .from("meal_trial_grants")
    .select("id, guest_account_id")
    .eq("status", "active")
    .lt("expires_at", nowIso);
  if (expiredError) return fail("만료 사용권 조회", expiredError.message);

  const grantIds: string[] = (expired || []).map((g: { id: string }) => g.id);
  const accountIds: string[] = (expired || [])
    .map((g: { guest_account_id: string | null }) => g.guest_account_id)
    .filter(Boolean);

  // 2) 계정 해제 → 3) 사용권 만료
  if (accountIds.length > 0) {
    const { error } = await db.from("meal_guest_accounts").update({ status: "available" }).in("id", accountIds);
    if (error) return fail("계정 해제", error.message);
  }
  if (grantIds.length > 0) {
    const { error } = await db.from("meal_trial_grants").update({ status: "expired" }).in("id", grantIds);
    if (error) return fail("사용권 만료 처리", error.message);
  }

  // 4) 보정: 유효한 사용권이 없는데 "배정됨"으로 남은 계정을 풀로 되돌린다.
  //    (발급 도중 요청이 끊기거나 수동 회수가 중간에 실패해 생긴 누수)
  let repaired = 0;
  const [{ data: assigned, error: assignedError }, { data: live, error: liveError }] = await Promise.all([
    db.from("meal_guest_accounts").select("id").eq("status", "assigned"),
    db.from("meal_trial_grants").select("guest_account_id").eq("status", "active").gt("expires_at", nowIso),
  ]);
  if (assignedError || liveError) {
    // 보정은 부가 작업이므로 실패해도 본 작업 결과는 유지하고 기록만 남긴다
    console.error("[cron/expire-trials] 누수 보정 조회 실패", assignedError?.message || liveError?.message);
  } else {
    const inUse = new Set((live || []).map((g: { guest_account_id: string | null }) => g.guest_account_id));
    const orphanIds: string[] = (assigned || [])
      .map((a: { id: string }) => a.id)
      .filter((id: string) => !inUse.has(id));
    if (orphanIds.length > 0) {
      const { error } = await db.from("meal_guest_accounts").update({ status: "available" }).in("id", orphanIds);
      if (error) console.error("[cron/expire-trials] 누수 보정 실패", error.message);
      else repaired = orphanIds.length;
    }
  }

  // (선택) 외부 식단관리 프로그램의 게스트 데이터 초기화 트리거.
  // 외부 프로그램이 이 웹훅을 받아 해당 계정 데이터를 비우도록 구현한다(미설정 시 skip).
  const webhook = process.env.MEAL_PLAN_RESET_WEBHOOK_URL;
  let webhookOk: boolean | null = null;
  if (webhook && accountIds.length > 0) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_ids: accountIds }),
        signal: AbortSignal.timeout(15_000),
      });
      webhookOk = res.ok;
      if (!res.ok) console.error("[cron/expire-trials] 초기화 웹훅 응답 오류", res.status);
    } catch (err) {
      // 외부 초기화 실패가 회수 자체를 막지 않도록 기록만 남긴다
      webhookOk = false;
      console.error("[cron/expire-trials] 초기화 웹훅 호출 실패", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    ok: true,
    expired: grantIds.length,
    released: accountIds.length,
    repaired,
    webhook: webhookOk,
    prices,
  });
}
