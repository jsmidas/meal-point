import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const ADMIN_ID = process.env.ADMIN_ID || "admin";
const ADMIN_PW = process.env.ADMIN_PW || "010675";
const COOKIE_NAME = "mp_admin_token";

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
  const { action, id, password } = body;

  if (action === "login") {
    // 1) 관리자 로그인 체크
    if (id === ADMIN_ID && password === ADMIN_PW) {
      const response = NextResponse.json({ ok: true, role: "admin" });
      response.cookies.set(COOKIE_NAME, JSON.stringify({ role: "admin" }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    // 2) 회원 로그인 체크
    const supabase = await createServerSupabase();
    const db = supabase.from("members") as any;
    const passwordHash = await hashPassword(password);

    const { data: member } = await db
      .select("id, login_id, name, is_active")
      .eq("login_id", id)
      .eq("password_hash", passwordHash)
      .maybeSingle();

    if (member) {
      if (!member.is_active) {
        return NextResponse.json(
          { ok: false, error: "비활성 계정입니다. 관리자에게 문의하세요." },
          { status: 403 }
        );
      }
      const response = NextResponse.json({
        ok: true,
        role: "member",
        name: member.name,
      });
      response.cookies.set(
        COOKIE_NAME,
        JSON.stringify({ role: "member", id: member.id, name: member.name }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        }
      );
      return response;
    }

    return NextResponse.json(
      { ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  if (action === "logout") {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return NextResponse.json({ authenticated: false });

  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json({
      authenticated: true,
      role: parsed.role,
      name: parsed.name || null,
    });
  } catch {
    // 기존 문자열 토큰 호환 (마이그레이션)
    if (raw === "mealpoint-admin-authenticated") {
      return NextResponse.json({ authenticated: true, role: "admin" });
    }
    return NextResponse.json({ authenticated: false });
  }
}
