import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CRON_SECRET = process.env.CRON_SECRET || "";

// 만료된 체험 사용권을 정리하고 게스트 계정을 풀로 회수한다.
// Vercel Cron이 매일 호출하며, Authorization: Bearer <CRON_SECRET> 헤더로 인증된다.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const nowIso = new Date().toISOString();

  // 만료된 활성 사용권
  const { data: expired } = await db
    .from("meal_trial_grants")
    .select("id, guest_account_id")
    .eq("status", "active")
    .lt("expires_at", nowIso);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grantIds = (expired || []).map((g: any) => g.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accountIds = (expired || []).map((g: any) => g.guest_account_id).filter(Boolean);

  if (grantIds.length > 0) {
    await db.from("meal_trial_grants").update({ status: "expired" }).in("id", grantIds);
  }
  if (accountIds.length > 0) {
    await db.from("meal_guest_accounts").update({ status: "available" }).in("id", accountIds);
  }

  // (선택) 외부 식단관리 프로그램의 게스트 데이터 초기화 트리거.
  // 외부 프로그램이 이 웹훅을 받아 해당 계정 데이터를 비우도록 구현한다(미설정 시 skip).
  const webhook = process.env.MEAL_PLAN_RESET_WEBHOOK_URL;
  if (webhook && accountIds.length > 0) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_ids: accountIds }),
      });
    } catch {
      // 외부 초기화 실패가 회수 자체를 막지 않도록 무시
    }
  }

  return NextResponse.json({ ok: true, expired: grantIds.length, released: accountIds.length });
}
