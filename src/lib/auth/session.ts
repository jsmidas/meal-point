/**
 * 서명된 세션 쿠키.
 *
 * 값 형식: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET))
 * - 서명이 없거나 틀리면 무효 → 쿠키를 임의로 만들어 role 을 바꾸는 위조가 불가능하다.
 * - 만료(exp)를 payload 에 넣어 서버에서 검증한다.
 * - Web Crypto 만 사용하므로 Edge(middleware)와 Node(API Route) 모두에서 동작한다.
 */
import type { SessionRole } from "./roles";

export const SESSION_COOKIE = "mp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일

export interface Session {
  role: SessionRole;
  id?: string | null;
  name?: string | null;
  company_id?: string | null;
  iat: number;
  exp: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET 환경 변수가 없거나 너무 짧습니다(32자 이상). `openssl rand -hex 32` 로 생성하세요.");
  }
  return s;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** 세션 쿠키 값을 만든다. */
export async function signSession(
  payload: Omit<Session, "iat" | "exp">,
  maxAgeSec: number = SESSION_MAX_AGE,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full: Session = { ...payload, iat: now, exp: now + maxAgeSec };
  const body = b64url(enc.encode(JSON.stringify(full)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

/** 쿠키 값을 검증해 세션을 돌려준다. 서명 불일치·만료·형식 오류·비밀키 미설정이면 null. */
export async function verifySession(raw: string | undefined | null): Promise<Session | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;
  try {
    // crypto.subtle.verify 는 상수 시간 비교
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const parsed = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
    if (!parsed || typeof parsed !== "object" || typeof parsed.role !== "string") return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Set-Cookie 옵션 */
export function sessionCookieOptions(maxAgeSec: number = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
