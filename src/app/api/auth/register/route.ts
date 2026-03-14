import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "mealpoint_salt_2024");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { login_id, password, name, company_name, phone, email } = body;

  if (!login_id || !password || !name) {
    return NextResponse.json(
      { ok: false, error: "아이디, 비밀번호, 이름은 필수입니다." },
      { status: 400 }
    );
  }

  if (login_id.length < 4) {
    return NextResponse.json(
      { ok: false, error: "아이디는 4자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  if (password.length < 4) {
    return NextResponse.json(
      { ok: false, error: "비밀번호는 4자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const db = supabase.from("members") as any;

  // 중복 아이디 확인
  const { data: existing } = await db
    .select("id")
    .eq("login_id", login_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "이미 사용 중인 아이디입니다." },
      { status: 409 }
    );
  }

  const password_hash = await hashPassword(password);

  const { error } = await db.insert({
    login_id,
    password_hash,
    name,
    company_name: company_name || null,
    phone: phone || null,
    email: email || null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "회원가입에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
