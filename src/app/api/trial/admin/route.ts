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
  const nowIso = new Date().toISOString();

  const [{ data: accounts }, { data: grants }] = await Promise.all([
    db.from("meal_guest_accounts").select("*").order("created_at"),
    db
      .from("meal_trial_grants")
      .select("id, member_id, guest_account_id, granted_at, expires_at, status, members(name, email), meal_guest_accounts(login_id, label)")
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .order("expires_at"),
  ]);

  return NextResponse.json({ accounts: accounts || [], grants: grants || [] });
}
