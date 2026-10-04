import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  const login_id = typeof body.login_id === "string" ? body.login_id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const company_name = typeof body.company_name === "string" ? body.company_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!login_id || !password || !name) {
    return NextResponse.json({ ok: false, error: "아이디, 비밀번호, 이름은 필수입니다." }, { status: 400 });
  }
  if (login_id.length < 4 || login_id.length > 64) {
    return NextResponse.json({ ok: false, error: "아이디는 4자 이상이어야 합니다." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ ok: false, error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }

  // members 는 anon 접근이 막혀 있으므로 서버 전용 service_role 로 처리
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase.from("members") as any;

  const { data: existing } = await db.select("id").eq("login_id", login_id).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: false, error: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }

  const password_hash = await hashPassword(password);
  const { error } = await db.insert({
    login_id,
    password_hash,
    name,
    company_name: company_name || null,
    phone: phone || null,
    email: email || null,
    role: "member",
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "회원가입에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
