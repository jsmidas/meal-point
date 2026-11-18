import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalSession } from "@/lib/auth/portal";
import { buildPortalOrder } from "@/lib/portal-order";

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
  const body = await request.json().catch(() => null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // 소유권 + 상태 확인 (되돌리기용으로 이전 값도 읽어 둔다)
  const { data: existing, error: existingErr } = await db
    .from("orders")
    .select("id, status, order_date, notes, total_amount, order_items(id)")
    .eq("id", id)
    .eq("company_id", session.companyId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ ok: false, error: "발주를 불러오지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: "발주를 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "이미 처리 중인 발주는 수정할 수 없습니다." },
      { status: 409 },
    );
  }

  // 수량·발주일 검증 + 단가 서버 확정 (거래처 단가 > 기본 판매가)
  const built = await buildPortalOrder(db, session.companyId, body);
  if (!built.ok) {
    return NextResponse.json({ ok: false, error: built.error }, { status: built.status });
  }
  const { items: orderItems, totalAmount, notes, orderDate } = built;
  const oldItemIds: string[] = (existing.order_items || []).map((it: { id: string }) => it.id);

  // 1. 주문 갱신 — 아직 pending 일 때만. 그 사이 관리자가 확정했으면 0건이 되므로 여기서 멈춘다.
  const { data: updated, error: updErr } = await db
    .from("orders")
    .update({ order_date: orderDate, notes, total_amount: totalAmount })
    .eq("id", id)
    .eq("company_id", session.companyId)
    .eq("status", "pending")
    .select("id");
  if (updErr) {
    return NextResponse.json({ ok: false, error: "발주 수정에 실패했습니다." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { ok: false, error: "이미 처리 중인 발주는 수정할 수 없습니다." },
      { status: 409 },
    );
  }

  // 2. 새 항목을 먼저 넣는다 — 실패하면 주문 정보를 되돌리고 기존 항목은 그대로 둔다
  const { error: itemErr } = await db
    .from("order_items")
    .insert(orderItems.map((it) => ({ ...it, order_id: id })));
  if (itemErr) {
    await db
      .from("orders")
      .update({ order_date: existing.order_date, notes: existing.notes, total_amount: existing.total_amount })
      .eq("id", id)
      .eq("company_id", session.companyId);
    console.error("[portal/orders PUT] 항목 저장 실패", itemErr.message);
    return NextResponse.json({ ok: false, error: "발주 항목 저장에 실패했습니다. 기존 발주는 그대로입니다." }, { status: 500 });
  }

  // 3. 기존 항목 삭제 (새 항목 저장이 확인된 뒤에만)
  if (oldItemIds.length > 0) {
    const { error: delErr } = await db.from("order_items").delete().in("id", oldItemIds);
    if (delErr) {
      console.error("[portal/orders PUT] 이전 항목 삭제 실패", { orderId: id, message: delErr.message });
      return NextResponse.json(
        { ok: false, error: "발주는 수정됐지만 이전 항목이 일부 남았습니다. 발주 내역을 확인하고 관리자에게 문의해주세요." },
        { status: 500 },
      );
    }
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

  const { data: cancelled, error } = await db
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("company_id", session.companyId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: "발주 취소에 실패했습니다." }, { status: 500 });
  }
  if (!cancelled || cancelled.length === 0) {
    // 확인과 갱신 사이에 관리자가 확정한 경우
    return NextResponse.json(
      { ok: false, error: "이미 처리 중인 발주는 취소할 수 없습니다." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
