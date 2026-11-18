/**
 * 로그인·회원가입 시도 제한.
 *
 * 횟수를 DB(auth_throttle 테이블, schema-v42)에 기록한다. 서버리스 환경에서는 요청마다 다른 인스턴스가
 * 처리할 수 있어, 인스턴스 메모리에만 세면 제한이 사실상 걸리지 않기 때문이다.
 * 테이블이 아직 없거나 DB 오류가 나면 인스턴스 메모리로 대신 센다(기능은 유지, 제한은 느슨해짐).
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Entry {
  count: number;
  windowStart: number; // ms
  lockedUntil: number; // ms, 0 이면 잠금 아님
}

export interface ThrottleRule {
  /** 이 횟수에 도달하면 잠근다 */
  max: number;
  /** 횟수를 세는 기간(ms). 지나면 다시 0부터 */
  windowMs: number;
  /** 잠금 시간(ms) */
  lockMs: number;
}

const memory = new Map<string, Entry>();
let dbUnavailableUntil = 0; // 테이블 없음 등으로 실패하면 잠시 DB 시도를 건너뛴다

/** 요청자의 IP. Vercel 은 x-real-ip / x-forwarded-for 를 플랫폼이 채운다. */
export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createAdminClient() as any).from("auth_throttle");
}

async function read(key: string): Promise<Entry | null> {
  if (Date.now() >= dbUnavailableUntil) {
    try {
      const { data, error } = await table()
        .select("count, window_start, locked_until")
        .eq("key", key)
        .maybeSingle();
      if (!error) {
        if (!data) return null;
        return {
          count: Number(data.count) || 0,
          windowStart: new Date(data.window_start).getTime(),
          lockedUntil: data.locked_until ? new Date(data.locked_until).getTime() : 0,
        };
      }
      dbUnavailableUntil = Date.now() + 60_000;
    } catch {
      dbUnavailableUntil = Date.now() + 60_000;
    }
  }
  return memory.get(key) ?? null;
}

async function write(key: string, e: Entry | null): Promise<void> {
  if (e) memory.set(key, e);
  else memory.delete(key);
  if (memory.size > 5000) memory.clear();
  if (Date.now() < dbUnavailableUntil) return;
  try {
    const res = e
      ? await table().upsert(
          {
            key,
            count: e.count,
            window_start: new Date(e.windowStart).toISOString(),
            locked_until: e.lockedUntil ? new Date(e.lockedUntil).toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        )
      : await table().delete().eq("key", key);
    if (res.error) dbUnavailableUntil = Date.now() + 60_000;
  } catch {
    dbUnavailableUntil = Date.now() + 60_000;
  }
}

/** 잠겨 있으면 잠금이 풀리는 시각(ms), 아니면 0 */
export async function lockedUntil(key: string): Promise<number> {
  const e = await read(key);
  return e && e.lockedUntil > Date.now() ? e.lockedUntil : 0;
}

/** 시도 1회를 기록한다. 규칙의 횟수에 도달하면 잠근다. */
export async function recordAttempt(key: string, rule: ThrottleRule): Promise<void> {
  const now = Date.now();
  const cur = await read(key);
  const fresh = !cur || now - cur.windowStart > rule.windowMs;
  const count = fresh ? 1 : cur.count + 1;
  await write(key, {
    count,
    windowStart: fresh ? now : cur.windowStart,
    lockedUntil: count >= rule.max ? now + rule.lockMs : 0,
  });
}

/** 기록을 지운다(로그인 성공 시). */
export async function clearAttempts(key: string): Promise<void> {
  await write(key, null);
}
