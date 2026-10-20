/**
 * 변경 이력(감사 로그) 기록 — 서버 전용.
 * 누가(세션) 어느 테이블의 어떤 행을 어떻게 바꿨는지 audit_logs 에 남긴다.
 * 기록 실패는 본 작업을 막지 않는다(콘솔 경고만).
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/lib/auth/session";

export interface AuditEntry {
  action: string; // insert | update | delete | upsert | login | ...
  table: string;
  recordId?: string | null;
  rowCount?: number;
  before?: unknown;
  after?: unknown;
  filters?: unknown;
}

const MAX_JSON_BYTES = 64 * 1024;

/** 비밀번호 해시 등 민감 컬럼 제거 + 너무 큰 값은 잘라서 저장 */
function sanitize(value: unknown): unknown {
  if (value === undefined) return null;
  const strip = (row: unknown): unknown => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (k === "password_hash" || k === "password") out[k] = "[redacted]";
      else out[k] = v;
    }
    return out;
  };
  const cleaned = Array.isArray(value) ? value.map(strip) : strip(value);
  try {
    const json = JSON.stringify(cleaned);
    if (json.length <= MAX_JSON_BYTES) return cleaned;
    return { _truncated: true, _bytes: json.length, preview: json.slice(0, 2000) };
  } catch {
    return null;
  }
}

function firstId(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && "id" in row) {
    const id = (row as { id?: unknown }).id;
    return typeof id === "string" ? id : id == null ? null : String(id);
  }
  return null;
}

function clientIp(request?: NextRequest): string | null {
  if (!request) return null;
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || null;
}

export async function writeAudit(
  db: SupabaseClient,
  session: Session | null,
  entry: AuditEntry,
  request?: NextRequest,
): Promise<void> {
  const rows = entry.after ?? entry.before;
  const count = entry.rowCount ?? (Array.isArray(rows) ? rows.length : rows ? 1 : 0);
  const record = {
    actor_role: session?.role || "anonymous",
    actor_id: session?.id || null,
    actor_login: session?.login || null,
    actor_name: session?.name || null,
    action: entry.action,
    table_name: entry.table,
    record_id: entry.recordId ?? firstId(entry.after) ?? firstId(entry.before) ?? null,
    row_count: count,
    before_data: sanitize(entry.before),
    after_data: sanitize(entry.after),
    filters: sanitize(entry.filters),
    ip: clientIp(request),
    user_agent: request?.headers.get("user-agent")?.slice(0, 300) || null,
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db.from("audit_logs") as any).insert(record);
    if (error) console.warn("[audit] 기록 실패:", error.message);
  } catch (e) {
    console.warn("[audit] 기록 실패:", e instanceof Error ? e.message : e);
  }
}
