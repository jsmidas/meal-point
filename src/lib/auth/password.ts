/**
 * 회원 비밀번호 해시.
 *
 * 새 형식: "pbkdf2$<iterations>$<salt b64>$<hash b64>"  (PBKDF2-SHA256, 개별 솔트)
 * 구 형식: SHA-256(비밀번호 + 고정 솔트) 16진수 64자 — 로그인 성공 시 새 형식으로 재해시한다.
 */

const LEGACY_SALT = "mealpoint_salt_2024";
const ITERATIONS = 100_000;
const enc = new TextEncoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

async function legacyHash(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(password + LEGACY_SALT));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** 저장용 해시 생성 (항상 새 형식) */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

/** 저장된 해시와 대조. needsRehash 가 true 면 새 형식으로 다시 저장할 것. */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!stored) return { ok: false, needsRehash: false };

  if (stored.startsWith("pbkdf2$")) {
    const [, iterStr, saltB64, hashB64] = stored.split("$");
    const iterations = parseInt(iterStr, 10);
    if (!iterations || !saltB64 || !hashB64) return { ok: false, needsRehash: false };
    const calc = await pbkdf2(password, fromB64(saltB64), iterations);
    const ok = timingSafeEqual(calc, fromB64(hashB64));
    return { ok, needsRehash: ok && iterations < ITERATIONS };
  }

  // 구 형식(64자 16진수)
  if (/^[0-9a-f]{64}$/i.test(stored)) {
    const calc = await legacyHash(password);
    const ok = timingSafeEqual(enc.encode(calc), enc.encode(stored.toLowerCase()));
    return { ok, needsRehash: ok };
  }

  return { ok: false, needsRehash: false };
}

/** 관리자 계정처럼 평문 비밀값끼리 비교할 때 쓰는 상수 시간 비교 */
export async function safeEqualString(a: string, b: string): Promise<boolean> {
  // 길이 차이로 인한 타이밍 누출을 막기 위해 다이제스트끼리 비교
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return timingSafeEqual(new Uint8Array(da), new Uint8Array(db)) && a.length === b.length;
}
