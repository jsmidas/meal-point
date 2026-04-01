/**
 * 클라이언트에서 DB 변경(insert/update/delete/upsert) 시 사용하는 헬퍼.
 * /api/db 를 통해 service_role 키로 실행되므로 anon RLS 제한을 우회.
 */

interface MutationResult<T = Record<string, unknown>> {
  data: T | T[] | null;
  error: string | null;
}

type Filter = { column: string; value: unknown };

async function mutate<T = Record<string, unknown>>(params: {
  table: string;
  action: "insert" | "update" | "delete" | "upsert";
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Filter[];
  options?: { onConflict?: string; returning?: boolean };
}): Promise<MutationResult<T>> {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

// ── 편의 함수 ──

export async function dbInsert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  options?: { returning?: boolean },
): Promise<MutationResult<T>> {
  return mutate<T>({ table, action: "insert", data, options });
}

export async function dbUpdate(
  table: string,
  data: Record<string, unknown>,
  filters: Record<string, unknown>,
): Promise<MutationResult> {
  return mutate({
    table,
    action: "update",
    data,
    filters: Object.entries(filters).map(([column, value]) => ({ column, value })),
  });
}

export async function dbDelete(
  table: string,
  filters: Record<string, unknown>,
): Promise<MutationResult> {
  return mutate({
    table,
    action: "delete",
    filters: Object.entries(filters).map(([column, value]) => ({ column, value })),
  });
}

export async function dbUpsert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  options?: { onConflict?: string; returning?: boolean },
): Promise<MutationResult<T>> {
  return mutate<T>({ table, action: "upsert", data, options });
}
