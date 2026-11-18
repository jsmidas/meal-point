import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, signSession, sessionCookieOptions, verifySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword, safeEqualString } from "@/lib/auth/password";
import { memberSessionRole, type SessionRole } from "@/lib/auth/roles";
import { writeAudit } from "@/lib/audit";
import { clientIp, clearAttempts, lockedUntil, recordAttempt, type ThrottleRule } from "@/lib/auth/throttle";

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

// ── 로그인 시도 제한 (DB 기록 — 서버 인스턴스가 바뀌어도 유지된다) ──
// 같은 IP에서 같은 아이디로 15분 안에 5회 실패 → 15분 잠금
const IP_ID_RULE: ThrottleRule = { max: 5, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 };
// IP를 바꿔 가며 한 아이디를 계속 두드리는 경우: 아이디 기준 15분 안에 20회 실패 → 15분 잠금
const ID_RULE: ThrottleRule = { max: 20, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 };

function throttleKeys(request: NextRequest, id: string) {
  const lower = id.toLowerCase();
  return { ipId: `login:${clientIp(request)}|${lower}`, idOnly: `login-id:${lower}` };
}
async function recordFail(keys: { ipId: string; idOnly: string }) {
  await Promise.all([recordAttempt(keys.ipId, IP_ID_RULE), recordAttempt(keys.idOnly, ID_RULE)]);
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

  const keys = throttleKeys(request, id);
  const locked = Math.max(await lockedUntil(keys.ipId), await lockedUntil(keys.idOnly));
  if (locked) {
    const mins = Math.ceil((locked - Date.now()) / 60000);
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
      await clearAttempts(keys.ipId);
      const payload = { role: acc.role, name: acc.name, login: acc.id };
      const token = await signSession(payload);
      const response = NextResponse.json({ ok: true, role: acc.role, name: acc.name });
      setSessionCookie(response, token);
      void writeAudit(createAdminClient(), { ...payload, iat: 0, exp: 0 }, { action: "login", table: "auth" }, request);
      return response;
    }
  }

  // 2) 회원 / 발주 계정 (members 테이블) — 서버 전용 service_role 로 조회
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = db.from("members") as any;
  const { data: member } = await members
    .select("id, login_id, name, is_active, role, company_id, password_hash, companies(name)")
    .eq("login_id", id)
    .maybeSingle();

  const check = await verifyPassword(password, member?.password_hash);
  if (!member || !check.ok) {
    await recordFail(keys);
    return NextResponse.json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  if (!member.is_active) {
    return NextResponse.json({ ok: false, error: "비활성 계정입니다. 관리자에게 문의하세요." }, { status: 403 });
  }

  // 구형 SHA-256 해시는 로그인 성공 시 PBKDF2 로 재저장
  if (check.needsRehash) {
    await members.update({ password_hash: await hashPassword(password) }).eq("id", member.id);
  }

  await clearAttempts(keys.ipId);
  // members.role='admin' 인 회원(다함푸드 직원 등)은 관리자 세션을 받는다
  const role: SessionRole = memberSessionRole(member);
  const companyName: string | null = member.companies?.name ?? null;
  const payload = { role, id: member.id, login: member.login_id, name: member.name, company_id: member.company_id || null, company_name: companyName };
  const token = await signSession(payload);
  const response = NextResponse.json({ ok: true, role, name: member.name, company_name: companyName });
  setSessionCookie(response, token);
  void writeAudit(db, { ...payload, iat: 0, exp: 0 }, { action: "login", table: "auth", recordId: member.id }, request);
  return response;
}

/**
 * 현재 로그인 상태.
 * 회원/발주 계정은 DB 의 최신 상태(승인 여부·연결 거래처)를 반영하고, 바뀌었으면 세션 쿠키를 다시 발급한다.
 * → 관리자가 승인하면 회원이 다시 로그인하지 않아도 다음 요청부터 업체 단가가 보인다.
 */
export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ authenticated: false });

  const base = { authenticated: true, role: session.role, name: session.name || null, company_id: session.company_id || null, company_name: session.company_name || null };
  if (!session.id) return NextResponse.json(base); // 환경변수 관리자

  // 회원 관리자(members.role='admin'): 비활성화·권한 회수가 즉시 반영되도록 DB 상태 확인
  if (session.role === "admin") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: m } = await (createAdminClient().from("members") as any)
        .select("is_active, role")
        .eq("id", session.id)
        .maybeSingle();
      if (!m || !m.is_active || m.role !== "admin") {
        const res = NextResponse.json({ authenticated: false });
        res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
        return res;
      }
    } catch { /* 조회 실패 시 세션 정보로 응답 */ }
    return NextResponse.json(base);
  }
  if (session.role !== "member" && session.role !== "company") {
    return NextResponse.json(base);
  }

  try {
    const db = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m, error } = await (db.from("members") as any)
      .select("id, name, is_active, role, company_id, approval_status, biz_cert_path, company_name, companies(name)")
      .eq("id", session.id)
      .maybeSingle();
    if (error) return NextResponse.json(base); // 일시 오류·마이그레이션 미적용 등 — 세션 정보로 응답

    // 삭제됐거나 정지된 회원은 로그아웃 처리
    if (!m || !m.is_active) {
      const res = NextResponse.json({ authenticated: false });
      res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
    const role: SessionRole = memberSessionRole(m);
    const companyName: string | null = m.companies?.name ?? null;
    const res = NextResponse.json({
      authenticated: true,
      role,
      name: m.name,
      company_id: m.company_id || null,
      company_name: companyName,
      member_company_name: m.company_name || null,
      approval_status: m.approval_status || "none",
      has_cert: !!m.biz_cert_path,
    });
    const changed = role !== session.role || (m.company_id || null) !== (session.company_id || null) || companyName !== (session.company_name || null) || m.name !== session.name;
    if (changed) {
      const token = await signSession({ role, id: m.id, login: session.login || null, name: m.name, company_id: m.company_id || null, company_name: companyName });
      res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    }
    return res;
  } catch {
    return NextResponse.json(base);
  }
}
