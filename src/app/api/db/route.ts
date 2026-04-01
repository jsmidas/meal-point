import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "mp_admin_token";

// 허용되는 테이블 목록 (화이트리스트)
const ALLOWED_TABLES = new Set([
  "company_info",
  "companies",
  "products",
  "company_prices",
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
]);

type Action = "insert" | "update" | "delete" | "upsert";

interface MutationRequest {
  table: string;
  action: Action;
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: { column: string; value: unknown }[];
  options?: { onConflict?: string; returning?: boolean };
}

function isAdmin(cookieStore: ReturnType<Awaited<ReturnType<typeof cookies>>["getAll"] extends () => infer R ? never : never>): boolean {
  // 간단하게 sync 처리
  return true; // placeholder, 실제 로직은 아래에서
}

export async function POST(request: NextRequest) {
  // 1. 관리자 인증 확인
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) {
    return NextResponse.json({ data: null, error: "인증이 필요합니다." }, { status: 401 });
  }

  let role = "";
  try {
    const parsed = JSON.parse(raw);
    role = parsed.role || "member";
  } catch {
    if (raw === "mealpoint-admin-authenticated") {
      role = "admin";
    }
  }

  if (role !== "admin") {
    return NextResponse.json({ data: null, error: "관리자 권한이 필요합니다." }, { status: 403 });
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
