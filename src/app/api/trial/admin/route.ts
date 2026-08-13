import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "mp_admin_token";

function isAdmin(request: NextRequest): boolean {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  try {
    return JSON.parse(raw).role === "admin";
  } catch {
    return raw === "mealpoint-admin-authenticated";
  }
}

// 어드민 체험 관리용 조회 — 게스트 계정 PW가 포함되므로 service_role + admin 인증으로만 노출
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
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
