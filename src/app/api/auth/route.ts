import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, signSession, sessionCookieOptions, verifySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword, safeEqualString } from "@/lib/auth/password";
import type { SessionRole } from "@/lib/auth/roles";

export const runtime = "nodejs";

const LEGACY_COOKIE = "mp_admin_token";

/**
 * 관리자 계정은 환경 변수로만 정의한다 (코드 기본값 없음).
 *   SUPER_ADMIN_ID / SUPER_ADMIN_PW → role: super_admin
 *   ADMIN_ID / ADMIN_PW             → role: admin
 * 환경 변수가 없으면 해당 계정으로는 로그인할 수 없다.
 */
function adminAccounts(): { id: string; pw: string; role: SessionRole; name: string }[] {
  const list: { id: string; pw: string; role: SessionRole; name: string }[] = [];
  if (process.env.SUPER_ADMIN_ID && process.env.SUPER_ADMIN_PW) {
    list.push({ id: process.env.SUPER_ADMIN_ID, pw: process.env.SUPER_ADMIN_PW, role: "super_admin", name: "최고관리자" });
  }
  if (process.env.ADMIN_ID && process.env.ADMIN_PW) {
    list.push({ id: process.env.ADMIN_ID, pw: process.env.ADMIN_PW, role: "admin", name: "관리자" });
  }
  return list;
}

// ── 로그인 시도 제한 (인스턴스 메모리 기준: IP+ID 당 15분 안에 5회 실패 시 15분 잠금) ──
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { fails: number; first: number; lockedUntil: number }>();

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}
function throttleKey(request: NextRequest, id: string) {
  return `${clientIp(request)}|${id.toLowerCase()}`;
}
function isLocked(key: string): number {
  const a = attempts.get(key);
  if (!a) return 0;
  if (a.lockedUntil > Date.now()) return a.lockedUntil;
  if (Date.now() - a.first > WINDOW_MS) attempts.delete(key);
  return 0;
}
function recordFail(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first > WINDOW_MS) {
    attempts.set(key, { fails: 1, first: now, lockedUntil: 0 });
    return;
  }
  a.fails += 1;
  if (a.fails >= MAX_FAILS) a.lockedUntil = now + WINDOW_MS;
}
function clearFails(key: string) {
  attempts.delete(key);
}

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  // 구형 평문 쿠키 제거
  response.cookies.set(LEGACY_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function POST(request: NextRequest) {
  let body: { action?: string; id?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  const { action } = body;

  if (action === "logout") {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(LEGACY_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  if (action !== "login") {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!id || !password || id.length > 64 || password.length > 128) {
    return NextResponse.json({ ok: false, error: "아이디와 비밀번호를 입력하세요." }, { status: 400 });
  }

  const key = throttleKey(request, id);
  const lockedUntil = isLocked(key);
  if (lockedUntil) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
    return NextResponse.json(
      { ok: false, error: `로그인 시도가 너무 많습니다. ${mins}분 후 다시 시도하세요.` },
      { status: 429 },
    );
  }

  // 1) 관리자 계정 (환경 변수)
  const accounts = adminAccounts();
  if (accounts.length === 0 || !process.env.SESSION_SECRET) {
    // 운영 환경변수 누락 시 원인을 서버 로그에 분명히 남긴다 (2026-10-04 로그인 불가 사고 — Vercel 환경변수 빈 값/미반영)
    console.error(
      "[auth] 관리자 로그인 설정 누락: " +
        `ADMIN_ID/ADMIN_PW=${process.env.ADMIN_ID && process.env.ADMIN_PW ? "OK" : "없음"}, ` +
        `SUPER_ADMIN_ID/PW=${process.env.SUPER_ADMIN_ID && process.env.SUPER_ADMIN_PW ? "OK" : "없음"}, ` +
        `SESSION_SECRET=${process.env.SESSION_SECRET ? "OK" : "없음"} — Vercel 환경변수 확인 후 재배포 필요`,
    );
    if (!process.env.SESSION_SECRET) {
      return NextResponse.json({ ok: false, error: "서버 설정 오류입니다. 관리자에게 문의하세요." }, { status: 500 });
    }
  }
  for (const acc of accounts) {
    const idMatch = await safeEqualString(id, acc.id);
    const pwMatch = await safeEqualString(password, acc.pw);
    if (idMatch && pwMatch) {
      clearFails(key);
      const token = await signSession({ role: acc.role, name: acc.name });
      const response = NextResponse.json({ ok: true, role: acc.role, name: acc.name });
      setSessionCookie(response, token);
      return response;
    }
  }

  // 2) 회원 / 발주 계정 (members 테이블) — 서버 전용 service_role 로 조회
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = db.from("members") as any;
  const { data: member } = await members
    .select("id, login_id, name, is_active, role, company_id, password_hash")
    .eq("login_id", id)
    .maybeSingle();

  const check = await verifyPassword(password, member?.password_hash);
  if (!member || !check.ok) {
    recordFail(key);
    return NextResponse.json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  if (!member.is_active) {
    return NextResponse.json({ ok: false, error: "비활성 계정입니다. 관리자에게 문의하세요." }, { status: 403 });
  }

  // 구형 SHA-256 해시는 로그인 성공 시 PBKDF2 로 재저장
  if (check.needsRehash) {
    await members.update({ password_hash: await hashPassword(password) }).eq("id", member.id);
  }

  clearFails(key);
  const role: SessionRole = member.role === "company" ? "company" : "member";
  const token = await signSession({ role, id: member.id, name: member.name, company_id: member.company_id || null });
  const response = NextResponse.json({ ok: true, role, name: member.name });
  setSessionCookie(response, token);
  return response;
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    role: session.role,
    name: session.name || null,
    company_id: session.company_id || null,
  });
}
