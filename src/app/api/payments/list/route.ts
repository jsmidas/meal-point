import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/guard";

async function checkAdmin(request: NextRequest): Promise<boolean> {
  return !!(await getAdminSession(request));
}

/** 관리자 결제건 목록 (payment_requests 는 RLS 차단이라 서버에서 조회) */
export async function GET(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const admin = createAdminClient();
  // 만료 처리: pending 인데 기한 지난 건 expired 로 일괄 갱신
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  await db
    .from("payment_requests")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  const { data, error } = await db
    .from("payment_requests")
    .select("*, companies(id, name)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}
