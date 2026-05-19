import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "mp_admin_token";

/** 관리자 인증 확인 (api/db 와 동일 규칙) */
function checkAdmin(request: NextRequest): boolean {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return (parsed.role || "member") === "admin";
  } catch {
    return raw === "mealpoint-admin-authenticated";
  }
}

export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  let body: {
    order_name?: string;
    amount?: number;
    company_id?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    memo?: string | null;
    expires_days?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const orderName = (body.order_name || "").trim();
  const amount = Math.floor(Number(body.amount));

  if (!orderName) {
    return NextResponse.json({ error: "상품명을 입력하세요." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 100) {
    return NextResponse.json({ error: "결제 금액은 100원 이상이어야 합니다." }, { status: 400 });
  }

  const token = randomUUID();
  // 토스 orderId 규칙: 영문/숫자/-/_ , 6~64자
  const tossOrderId = `MP${randomUUID().replace(/-/g, "")}`;

  const days = Number.isFinite(body.expires_days) && body.expires_days! > 0 ? body.expires_days! : 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("payment_requests")
    .insert({
      token,
      toss_order_id: tossOrderId,
      company_id: body.company_id || null,
      order_name: orderName,
      amount,
      customer_name: body.customer_name || null,
      customer_phone: body.customer_phone || null,
      memo: body.memo || null,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    new URL(request.url).origin;

  return NextResponse.json({
    data,
    url: `${origin}/pay/${token}`,
  });
}
