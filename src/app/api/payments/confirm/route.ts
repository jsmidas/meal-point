import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmTossPayment, getTossPaymentByOrderId, seoulDate, type TossResult } from "@/lib/toss";
import { generateBillingNumber } from "@/lib/utils";

export const runtime = "nodejs";

// 승인 결과를 확정할 수 없어, 토스에 실제 결제 상태를 조회해 볼 가치가 있는 실패 코드
const RECOVERABLE_CODES = new Set(["ALREADY_PROCESSED_PAYMENT", "NETWORK_ERROR", "INVALID_RESPONSE"]);

/**
 * 결제 승인 + 검증. 거래처용 success 페이지에서 호출된다.
 * 금액은 항상 DB 값(payment_requests.amount) 기준으로 검증한다.
 * 결제 완료 시 거래처가 지정돼 있으면 정산관리(billings/payments)에 자동 반영한다.
 */
export async function POST(request: NextRequest) {
  let body: { token?: string; paymentKey?: string; orderId?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { token, paymentKey, orderId } = body;
  const amount = Math.floor(Number(body.amount));

  if (!token || !paymentKey || !orderId || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: pr, error: prError } = await db
    .from("payment_requests")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (prError) {
    console.error("[payments/confirm] 결제 요청 조회 실패", prError.message);
    return NextResponse.json({ error: "일시적인 오류입니다. 잠시 후 새로고침해 주세요." }, { status: 500 });
  }
  if (!pr) {
    return NextResponse.json({ error: "결제 요청을 찾을 수 없습니다." }, { status: 404 });
  }

  // 멱등 처리: 이미 승인된 건이면 그대로 성공 반환
  if (pr.status === "paid") {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  if (pr.status === "canceled") {
    return NextResponse.json({ error: "취소된 결제 요청입니다." }, { status: 400 });
  }
  // 위변조 차단: 주문번호/금액을 DB 값과 대조
  if (pr.toss_order_id !== orderId || pr.amount !== amount) {
    return NextResponse.json({ error: "결제 정보가 일치하지 않습니다." }, { status: 400 });
  }

  const isExpired = pr.status !== "pending" || new Date(pr.expires_at).getTime() < Date.now();
  let result: TossResult;

  if (isExpired) {
    // 만료된 링크는 새로 승인하지 않는다. 다만 만료 직전에 이미 승인된 결제(저장만 실패)일 수 있으므로
    // 실제 결제 상태를 조회해, 결제가 끝난 건이면 기록만 남긴다.
    const lookup = await getTossPaymentByOrderId(orderId);
    if (!lookup.ok || lookup.data.status !== "DONE") {
      if (pr.status === "pending") {
        await db.from("payment_requests").update({ status: "expired" }).eq("id", pr.id).eq("status", "pending");
      }
      return NextResponse.json({ error: "만료된 결제 링크입니다." }, { status: 400 });
    }
    result = lookup;
  } else {
    // 토스 결제 승인
    result = await confirmTossPayment({ paymentKey, orderId, amount });

    // 승인 결과를 받지 못했거나(시간 초과·통신 오류) 이미 처리된 결제면, 실제 상태를 조회해 복구한다.
    // (예: 토스는 승인했는데 우리 쪽 저장 전에 요청이 끊긴 뒤 고객이 새로고침한 경우)
    if (!result.ok && RECOVERABLE_CODES.has(result.code)) {
      const lookup = await getTossPaymentByOrderId(orderId);
      if (lookup.ok) result = lookup;
    }
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
  }

  // 토스 응답 검증: 실제로 결제가 끝났고, 주문번호·금액이 우리 DB 값과 같아야 한다
  if (result.data.orderId !== pr.toss_order_id || result.data.totalAmount !== pr.amount) {
    console.error("[payments/confirm] 토스 응답 불일치", {
      requestId: pr.id,
      orderId: result.data.orderId,
      totalAmount: result.data.totalAmount,
    });
    return NextResponse.json(
      { error: "결제 정보가 일치하지 않습니다. 판매자에게 문의해 주세요." },
      { status: 400 },
    );
  }
  if (result.data.status !== "DONE") {
    return NextResponse.json(
      { error: "결제가 아직 완료되지 않았습니다. 잠시 후 다시 확인해 주세요.", code: result.data.status },
      { status: 400 },
    );
  }

  const paidAtIso = result.data.approvedAt
    ? new Date(result.data.approvedAt).toISOString()
    : new Date().toISOString();

  // 결제완료로 먼저 확정한다 — 아직 결제 전 상태(pending, 또는 그 사이 만료 처리된 expired)인 경우에만.
  // 조건부 갱신이라 동시 요청이 와도 한 번만 성공하고, 정산 반영도 한 번만 일어난다.
  const { data: claimed, error: claimError } = await db
    .from("payment_requests")
    .update({
      status: "paid",
      payment_key: result.data.paymentKey,
      method: result.data.method,
      receipt_url: result.data.receipt?.url ?? null,
      paid_at: paidAtIso,
    })
    .eq("id", pr.id)
    .in("status", ["pending", "expired"])
    .select("id");

  if (claimError) {
    // 결제는 승인됐는데 기록을 못 남긴 상태. 다시 호출하면 위의 조회 경로로 복구된다.
    console.error("[payments/confirm] 결제완료 저장 실패", { requestId: pr.id, message: claimError.message });
    return NextResponse.json(
      {
        error: "결제는 승인되었으나 기록 저장에 실패했습니다. 잠시 후 이 화면을 새로고침해 주세요.",
        code: "SAVE_FAILED",
      },
      { status: 500 },
    );
  }
  if (!claimed || claimed.length === 0) {
    // 다른 요청이 먼저 처리했거나 그 사이 상태가 바뀜 — 현재 상태로 답한다
    const { data: now } = await db.from("payment_requests").select("status").eq("id", pr.id).maybeSingle();
    if (now?.status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });
    console.error("[payments/confirm] 결제 승인됐으나 요청이 취소 등 결제 불가 상태", {
      requestId: pr.id,
      status: now?.status,
    });
    return NextResponse.json(
      {
        error: "결제는 승인되었으나 요청 상태를 갱신하지 못했습니다. 판매자에게 문의해 주세요.",
        code: "STATE_CONFLICT",
      },
      { status: 409 },
    );
  }

  // ── 정산관리 자동 반영 (거래처 지정 시) ──
  // 실패해도 결제 성공 자체는 유지한다. billing_id 가 비어 있으면 관리자 화면에 "정산 미반영"으로 표시된다.
  if (pr.company_id) {
    const reflected = await reflectToBilling(db, pr, paidAtIso);
    if (reflected.billingId || reflected.paymentId) {
      const { error: linkError } = await db
        .from("payment_requests")
        .update({ billing_id: reflected.billingId, payment_id: reflected.paymentId })
        .eq("id", pr.id);
      if (linkError) {
        console.error("[payments/confirm] 정산 연결 저장 실패", { requestId: pr.id, message: linkError.message });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * 결제 건을 해당 월 청구(billings)와 입금(payments)에 반영한다.
 * 각 단계의 오류를 기록하고, 가능한 데까지만 진행한다(예외를 밖으로 던지지 않음).
 */
async function reflectToBilling(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  pr: { id: string; company_id: string; amount: number; order_name: string },
  paidAtIso: string,
): Promise<{ billingId: string | null; paymentId: string | null }> {
  const fail = (step: string, message: string) =>
    console.error(`[payments/confirm] 정산 반영 실패(${step})`, { requestId: pr.id, message });

  try {
    const payDate = seoulDate(new Date(paidAtIso)); // YYYY-MM-DD
    const month = payDate.slice(0, 7); // YYYY-MM

    const findBilling = () =>
      db.from("billings").select("*").eq("company_id", pr.company_id).eq("billing_month", month).maybeSingle();

    // 해당 월 청구 조회, 없으면 생성 (번호 충돌·동시 생성 시 재조회 후 재시도)
    const first = await findBilling();
    if (first.error) {
      fail("청구 조회", first.error.message);
      return { billingId: null, paymentId: null };
    }
    let billing = first.data;

    for (let attempt = 0; !billing && attempt < 5; attempt++) {
      const { data: created, error: createError } = await db
        .from("billings")
        .insert({
          billing_number: generateBillingNumber(month),
          company_id: pr.company_id,
          billing_month: month,
          total_supply: 0,
          total_tax: 0,
          total_amount: pr.amount,
          notes: "개인결제(카드) 자동 생성",
        })
        .select()
        .single();
      if (created) {
        billing = created;
        break;
      }
      // 같은 거래처·월 청구를 다른 요청이 먼저 만들었을 수 있다 → 재조회
      const again = await findBilling();
      if (again.data) {
        billing = again.data;
        break;
      }
      if (createError && createError.code !== "23505") {
        fail("청구 생성", createError.message);
        return { billingId: null, paymentId: null };
      }
      // 23505(청구번호 중복)이면 새 번호로 다시 시도
    }
    if (!billing) {
      fail("청구 생성", "번호 충돌로 생성하지 못함");
      return { billingId: null, paymentId: null };
    }

    const { data: pay, error: payError } = await db
      .from("payments")
      .insert({
        billing_id: billing.id,
        amount: pr.amount,
        payment_date: payDate,
        payment_method: "card",
        notes: `개인결제(카드) - ${pr.order_name}`,
      })
      .select()
      .single();
    if (payError || !pay) {
      fail("입금 기록", payError?.message || "결과 없음");
      return { billingId: billing.id, paymentId: null };
    }

    // payments 합산으로 paid_amount 재계산 (정산 페이지와 동일 로직)
    const { data: payRows, error: sumError } = await db
      .from("payments")
      .select("amount")
      .eq("billing_id", billing.id);
    if (sumError) {
      fail("입금 합산", sumError.message);
      return { billingId: billing.id, paymentId: pay.id };
    }
    const newPaid = (payRows || []).reduce((s: number, p: { amount: number }) => s + p.amount, 0);
    const total = billing.total_amount || pr.amount;
    const newStatus = newPaid <= 0 ? "unpaid" : newPaid >= total ? "paid" : "partial";
    const { error: updError } = await db
      .from("billings")
      .update({
        paid_amount: newPaid,
        status: newStatus,
        paid_date: newStatus === "paid" ? payDate : billing.paid_date ?? null,
      })
      .eq("id", billing.id);
    if (updError) fail("청구 입금액 갱신", updError.message);

    return { billingId: billing.id, paymentId: pay.id };
  } catch (err) {
    fail("예외", err instanceof Error ? err.message : String(err));
    return { billingId: null, paymentId: null };
  }
}
