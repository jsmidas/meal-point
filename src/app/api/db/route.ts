import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guard";

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
  // 1. 관리자 인증 확인 (서명된 세션 쿠키)
  const denied = await requireAdmin(request);
  if (denied) return denied;

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

    switch (action) {
      case "insert":
        query = query.insert(data);
        if (options.returning !== false) query = query.select();
        break;
      case "update":
        query = query.update(data);
        break;
      case "delete":
        query = query.delete();
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

    return NextResponse.json({ data: result, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
