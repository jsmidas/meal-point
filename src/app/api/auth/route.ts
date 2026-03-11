import { NextRequest, NextResponse } from "next/server";

const ADMIN_ID = process.env.ADMIN_ID || "admin";
const ADMIN_PW = process.env.ADMIN_PW || "010675";
const COOKIE_NAME = "mp_admin_token";
const TOKEN_VALUE = "mealpoint-admin-authenticated";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, id, password } = body;

  if (action === "login") {
    if (id === ADMIN_ID && password === ADMIN_PW) {
      const response = NextResponse.json({ ok: true });
      response.cookies.set(COOKIE_NAME, TOKEN_VALUE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7일
      });
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
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return NextResponse.json({ authenticated: token === TOKEN_VALUE });
}
