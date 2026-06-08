import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalSession } from "@/lib/auth/portal";
import { generateOrderNumber } from "@/lib/utils";

/**
 * 포털 발주 — 거래처 발주 계정 전용.
 * 보안 척추: company_id 는 쿠키 세션에서, 단가는 DB에서 서버가 확정한다.
 * 클라이언트는 product_id 와 수량만 보낼 수 있다.
 */

// 내 거래처 발주 목록 (항목 포함)
export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 401 });
  }

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("orders") as any)
    .select(
      "id, order_number, order_date, status, total_amount, notes, source, created_at, order_items(product_name, unit, quantity, unit_price, amount)",
    )
    .eq("company_id", session.companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, orders: data || [] });
}

// 발주 생성
export async function POST(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 401 });
  }

  const body = await request.json();
  const rawItems: { product_id?: string; quantity?: number }[] = Array.isArray(body.items)
    ? body.items
    : [];
  const notes: string | null = body.notes ? String(body.notes) : null;
  const orderDate: string =
    typeof body.order_date === "string" && body.order_date
      ? body.order_date
      : new Date().toISOString().slice(0, 10);

  // 수량 > 0 인 항목만
  const wanted = rawItems
    .map((i) => ({ product_id: String(i.product_id || ""), quantity: Number(i.quantity) || 0 }))
    .filter((i) => i.product_id && i.quantity > 0);

  if (wanted.length === 0) {
    return NextResponse.json(
      { ok: false, error: "발주할 상품과 수량을 입력하세요." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const productIds = [...new Set(wanted.map((i) => i.product_id))];

  // 단가는 서버가 DB에서 확정 (거래처 단가 > 기본 판매가)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: products }, { data: prices }] = await Promise.all([
    (supabase.from("products") as any)
      .select("id, name, unit, selling_price, is_active")
      .in("id", productIds),
    (supabase.from("company_prices") as any)
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

  // 항목 구성 + 검증
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

  // 주문번호 생성 (충돌 시 재시도)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersTable = supabase.from("orders") as any;
  let order: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await ordersTable
      .insert({
        order_number: generateOrderNumber(),
        company_id: session.companyId,
        order_date: orderDate,
        status: "pending",
        total_amount: totalAmount,
        notes,
        created_by: session.memberId,
        source: "portal",
      })
      .select("id")
      .single();

    if (!error && data) {
      order = data;
      break;
    }
    // 23505 = unique_violation (order_number 충돌) → 재시도
    if (error?.code !== "23505") {
      return NextResponse.json(
        { ok: false, error: error?.message || "발주 생성에 실패했습니다." },
        { status: 500 },
      );
    }
  }

  if (!order) {
    return NextResponse.json(
      { ok: false, error: "주문번호 생성에 실패했습니다. 다시 시도해주세요." },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: itemErr } = await (supabase.from("order_items") as any).insert(
    orderItems.map((it) => ({ ...it, order_id: order!.id })),
  );
  if (itemErr) {
    // 항목 저장 실패 시 주문 롤백
    await ordersTable.delete().eq("id", order.id);
    return NextResponse.json(
      { ok: false, error: "발주 항목 저장에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, order_id: order.id });
}
