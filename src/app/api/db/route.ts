import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

// 허용되는 테이블 목록 (화이트리스트)
const ALLOWED_TABLES = new Set([
  "company_info",
  "companies",
  "products",
  "company_prices",
  "company_price_history",
  "orders",
  "order_items",
  "statements",
  "statement_items",
  "quotes",
  "quote_items",
  "billings",
  "payments",
  "inventory",
  "inventory_logs",
  "expenses",
  "product_pages",
  "quote_send_logs",
  "statement_send_logs",
  "sale_checks",
  "popups",
  "payment_requests",
  "meal_guest_accounts",
  "meal_trial_grants",
]);

type Action = "insert" | "update" | "delete" | "upsert";

interface MutationRequest {
  table: string;
  action: Action;
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: { column: string; value: unknown }[];
  options?: { onConflict?: string; returning?: boolean };
}

export async function POST(request: NextRequest) {
  // 1. 관리자 인증 확인 (서명된 세션 쿠키) — 세션은 변경 이력(누가 바꿨는지) 기록에 쓴다
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, data: null, error: "관리자 권한이 필요합니다." }, { status: 401 });
  }

  // 2. 요청 파싱
  let body: MutationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { table, action, data, filters = [], options = {} } = body;

  // 3. 테이블 화이트리스트 검증
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ data: null, error: `허용되지 않는 테이블: ${table}` }, { status: 400 });
  }

  // 4. 액션 검증
  if (!["insert", "update", "delete", "upsert"].includes(action)) {
    return NextResponse.json({ data: null, error: `허용되지 않는 액션: ${action}` }, { status: 400 });
  }

  // 5. service_role 클라이언트로 실행
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = admin.from(table);

    // 변경 이력용: update/delete 는 바꾸기 전 행을 먼저 읽어 둔다
    let before: unknown = null;
    if (action === "update" || action === "delete") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pre: any = admin.from(table).select("*");
      for (const f of filters) pre = pre.eq(f.column, f.value);
      const { data: preRows } = await pre;
      before = preRows ?? null;
    }

    switch (action) {
      case "insert":
        query = query.insert(data);
        if (options.returning !== false) query = query.select();
        break;
      case "update":
        query = query.update(data).select();
        break;
      case "delete":
        query = query.delete().select();
        break;
      case "upsert":
        query = query.upsert(data, options.onConflict ? { onConflict: options.onConflict } : undefined);
        if (options.returning !== false) query = query.select();
        break;
    }

    // 필터 적용
    for (const f of filters) {
      query = query.eq(f.column, f.value);
    }

    const { data: result, error } = await query;

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 400 });
    }

    // 변경 이력 기록 (실패해도 본 작업 결과에는 영향 없음)
    const affected = Array.isArray(result) ? result : result ? [result] : [];
    const after = action === "delete" ? null : affected.length > 0 ? affected : data ?? null;
    await writeAudit(
      admin,
      session,
      {
        action,
        table,
        before,
        after,
        filters: filters.length > 0 ? filters : null,
        rowCount: action === "delete" ? (Array.isArray(before) ? before.length : affected.length) : Math.max(affected.length, Array.isArray(data) ? data.length : data ? 1 : 0),
      },
      request,
    );

    // 기존 호출부 호환: update/delete 는 원래 data 를 돌려주지 않았으므로 null 유지
    return NextResponse.json({ data: action === "update" || action === "delete" ? null : result, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
