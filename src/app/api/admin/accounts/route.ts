import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

/** 발주 계정(role='company') 관리 — 관리자 전용. 인증은 서명된 세션 쿠키(requireAdmin)로 확인. */

// 발주 계정 목록 (거래처명 포함)
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const companyId = request.nextUrl.searchParams.get("company_id");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("members") as any)
    .select("id, login_id, name, is_active, company_id, role, created_at, companies(name)")
    .eq("role", "company")
    .order("created_at", { ascending: false });
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, accounts: data || [] });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json();
  const { action } = body;
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase.from("members") as any;

  // ── 계정 발급 ──
  if (action === "create") {
    const { login_id, password, name, company_id } = body;
    if (!login_id || !password || !name || !company_id) {
      return NextResponse.json(
        { ok: false, error: "아이디, 비밀번호, 담당자명, 거래처는 필수입니다." },
        { status: 400 },
      );
    }
    if (String(login_id).length < 4 || String(password).length < 4) {
      return NextResponse.json(
        { ok: false, error: "아이디와 비밀번호는 4자 이상이어야 합니다." },
        { status: 400 },
      );
    }

    const { data: existing } = await db
      .select("id")
      .eq("login_id", login_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "이미 사용 중인 아이디입니다." },
        { status: 409 },
      );
    }

    const password_hash = await hashPassword(password);
    const { error } = await db.insert({
      login_id,
      password_hash,
      name,
      company_id,
      role: "company",
      provider: "local",
      is_active: true,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 비밀번호 초기화 ──
  if (action === "reset_password") {
    const { id, password } = body;
    if (!id || !password || String(password).length < 4) {
      return NextResponse.json(
        { ok: false, error: "비밀번호는 4자 이상이어야 합니다." },
        { status: 400 },
      );
    }
    const password_hash = await hashPassword(password);
    const { error } = await db.update({ password_hash }).eq("id", id).eq("role", "company");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 활성/비활성 토글 ──
  if (action === "toggle_active") {
    const { id, is_active } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id가 필요합니다." }, { status: 400 });
    }
    const { error } = await db
      .update({ is_active: !!is_active })
      .eq("id", id)
      .eq("role", "company");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 계정 정보 수정 (담당자명, 연결 거래처 변경) ──
  if (action === "update") {
    const { id, name, company_id } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id가 필요합니다." }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (company_id !== undefined) patch.company_id = company_id;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "변경할 내용이 없습니다." }, { status: 400 });
    }
    const { error } = await db.update(patch).eq("id", id).eq("role", "company");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 계정 삭제 ──
  if (action === "delete") {
    const { id } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id가 필요합니다." }, { status: 400 });
    }
    const { error } = await db.delete().eq("id", id).eq("role", "company");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "알 수 없는 요청입니다." }, { status: 400 });
}
