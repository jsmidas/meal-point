import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit";

async function isAdmin(request: NextRequest): Promise<boolean> {
  return !!(await getAdminSession(request));
}

// 어드민 체험 관리용 조회 — 게스트 계정 PW가 포함되므로 service_role + admin 인증으로만 노출
export async function GET(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // grants는 만료·회수 포함 전체 이력 반환 — 진행 중/만료 구분은 화면에서 표시
  // (접속 여부와 무관하게 "아이디를 부여받아 기한을 가진" 발급 건이 모두 보이도록)
  const [{ data: accounts }, { data: grants }] = await Promise.all([
    db.from("meal_guest_accounts").select("*").order("created_at"),
    db
      .from("meal_trial_grants")
      .select("id, member_id, guest_account_id, granted_at, expires_at, status, members(name, email), meal_guest_accounts(login_id, label)")
      .order("granted_at", { ascending: false })
      .limit(200),
  ]);

  return NextResponse.json({ accounts: accounts || [], grants: grants || [] });
}

/**
 * 재체험 허용 — 체험을 마친 회원이 한 번 더 신청할 수 있게 한다. 관리자 전용.
 * 그 회원의 지난 사용권(만료·회수·기한 지난 것)을 status='reopened' 로 바꾼다. 이력은 지우지 않는다.
 * 지금 체험 중인 사용권이 있으면 바꿀 것이 없으므로 거절한다.
 */
export async function POST(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const memberId = body && typeof body.member_id === "string" ? body.member_id : "";
  if (!body || body.action !== "reopen" || !/^[0-9a-f-]{36}$/i.test(memberId)) {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const nowIso = new Date().toISOString();

  const { data: grants, error } = await db
    .from("meal_trial_grants")
    .select("id, guest_account_id, status, expires_at")
    .eq("member_id", memberId)
    .neq("status", "reopened");
  if (error) {
    return NextResponse.json({ ok: false, error: "체험 이력을 불러오지 못했습니다." }, { status: 500 });
  }
  const rows = (grants || []) as { id: string; guest_account_id: string | null; status: string; expires_at: string }[];
  if (rows.some((g) => g.status === "active" && g.expires_at > nowIso)) {
    return NextResponse.json({ ok: false, error: "지금 체험 중인 회원입니다. 재체험 허용이 필요하지 않습니다." }, { status: 409 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, reopened: 0 });
  }

  // 기한이 지났는데 아직 정리되지 않은 사용권이 붙잡고 있는 계정은 함께 풀어 준다
  const staleAccountIds = rows.filter((g) => g.status === "active" && g.guest_account_id).map((g) => g.guest_account_id);
  if (staleAccountIds.length > 0) {
    const { error: relErr } = await db.from("meal_guest_accounts").update({ status: "available" }).in("id", staleAccountIds);
    if (relErr) console.error("[trial/admin] 계정 해제 실패", relErr.message);
  }

  const { error: updErr } = await db
    .from("meal_trial_grants")
    .update({ status: "reopened" })
    .in("id", rows.map((g) => g.id));
  if (updErr) {
    return NextResponse.json({ ok: false, error: "재체험 허용 처리에 실패했습니다." }, { status: 500 });
  }

  await writeAudit(
    admin,
    session,
    { action: "update", table: "meal_trial_grants", recordId: memberId, after: { status: "reopened", count: rows.length }, rowCount: rows.length },
    request,
  );
  return NextResponse.json({ ok: true, reopened: rows.length });
}
