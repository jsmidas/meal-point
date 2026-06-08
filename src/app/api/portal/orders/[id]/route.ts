import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalSession } from "@/lib/auth/portal";

/**
 * 포털 발주 단건 — 거래처 발주 계정 전용.
 * 본인 거래처(company_id)의, 승인 전(status='pending') 발주만 수정/취소 가능.
 * 단가는 서버가 DB에서 재확정한다(클라이언트 값 신뢰 안 함).
 */

// 수정 폼 프리필용 단건 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 401 });
  }
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { data, error } = await db
    .from("orders")
    .select("id, order_date, notes, status, order_items(product_id, quantity)")
    .eq("id", id)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "발주를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true, order: data });
}

// 발주 수정 (pending 만)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();

  const rawItems: { product_id?: string; quantity?: number }[] = Array.isArray(body.items)
    ? body.items
    : [];
  const notes: string | null = body.notes ? String(body.notes) : null;
  const orderDate: string =
    typeof body.order_date === "string" && body.order_date
      ? body.order_date
      : new Date().toISOString().slice(0, 10);

  const wanted = rawItems
    .map((i) => ({ product_id: String(i.product_id || ""), quantity: Number(i.quantity) || 0 }))
    .filter((i) => i.product_id && i.quantity > 0);
  if (wanted.length === 0) {
    return NextResponse.json({ ok: false, error: "발주할 상품과 수량을 입력하세요." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // 소유권 + 상태 확인
  const { data: existing } = await db
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .eq("company_id", session.companyId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "발주를 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "이미 처리 중인 발주는 수정할 수 없습니다." },
      { status: 409 },
    );
  }

  // 단가 서버 확정 (거래처 단가 > 기본 판매가)
  const productIds = [...new Set(wanted.map((i) => i.product_id))];
  const [{ data: products }, { data: prices }] = await Promise.all([
    db.from("products").select("id, name, unit, selling_price, is_active").in("id", productIds),
    db
      .from("company_prices")
      .select("product_id, custom_price")
      .eq("company_id", session.companyId)
      .in("product_id", productIds),
  ]);

  const productMap = new Map<
    string,
    { name: string; unit: string; selling_price: number; is_active: boolean }
  >();
  for (const p of products || []) productMap.set(p.id, p);
  const priceMap: Record<string, number> = {};
  for (const row of prices || []) priceMap[row.product_id] = Number(row.custom_price);

  const orderItems: {
    product_id: string;
    product_name: string;
    unit: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }[] = [];
  for (const w of wanted) {
    const p = productMap.get(w.product_id);
    if (!p || !p.is_active) {
      return NextResponse.json(
        { ok: false, error: "판매 중이 아닌 상품이 포함되어 있습니다." },
        { status: 400 },
      );
    }
    const unitPrice = priceMap[w.product_id] ?? p.selling_price ?? 0;
    orderItems.push({
      product_id: w.product_id,
      product_name: p.name,
      unit: p.unit,
      quantity: w.quantity,
      unit_price: unitPrice,
      amount: unitPrice * w.quantity,
    });
  }
  const totalAmount = orderItems.reduce((s, i) => s + i.amount, 0);

  // 주문 갱신 (경합 방지: 그 사이 확정됐으면 status='pending' 조건에 안 걸려 갱신 안 됨)
  const { error: updErr } = await db
    .from("orders")
    .update({ order_date: orderDate, notes, total_amount: totalAmount })
    .eq("id", id)
    .eq("company_id", session.companyId)
    .eq("status", "pending");
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  // 항목 교체
  await db.from("order_items").delete().eq("order_id", id);
  const { error: itemErr } = await db
    .from("order_items")
    .insert(orderItems.map((it) => ({ ...it, order_id: id })));
  if (itemErr) {
    return NextResponse.json({ ok: false, error: "발주 항목 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, order_id: id });
}

// 발주 취소 (pending 만) — status='cancelled'
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "cancel") {
    return NextResponse.json({ ok: false, error: "지원하지 않는 동작입니다." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { data: existing } = await db
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .eq("company_id", session.companyId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "발주를 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "이미 처리 중인 발주는 취소할 수 없습니다." },
      { status: 409 },
    );
  }

  const { error } = await db
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("company_id", session.companyId)
    .eq("status", "pending");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
