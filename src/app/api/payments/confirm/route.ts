import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmTossPayment, seoulDate } from "@/lib/toss";
import { generateBillingNumber } from "@/lib/utils";

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

  const { data: pr } = await db
    .from("payment_requests")
    .select("*")
    .eq("token", token)
    .single();

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
  if (new Date(pr.expires_at).getTime() < Date.now()) {
    await db.from("payment_requests").update({ status: "expired" }).eq("id", pr.id);
    return NextResponse.json({ error: "만료된 결제 링크입니다." }, { status: 400 });
  }

  // 위변조 차단: 주문번호/금액을 DB 값과 대조
  if (pr.toss_order_id !== orderId || pr.amount !== amount) {
    return NextResponse.json({ error: "결제 정보가 일치하지 않습니다." }, { status: 400 });
  }

  // 토스 결제 승인
  const result = await confirmTossPayment({ paymentKey, orderId, amount });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
  }

  const paidAtIso = result.data.approvedAt
    ? new Date(result.data.approvedAt).toISOString()
    : new Date().toISOString();

  // ── 정산관리 자동 반영 (거래처 지정 시) ──
  let billingId: string | null = null;
  let paymentId: string | null = null;

  if (pr.company_id) {
    try {
      const month = seoulDate(new Date(paidAtIso)).slice(0, 7); // YYYY-MM
      const payDate = seoulDate(new Date(paidAtIso)); // YYYY-MM-DD

      // 해당 월 청구 조회, 없으면 생성
      const { data: existing } = await db
        .from("billings")
        .select("*")
        .eq("company_id", pr.company_id)
        .eq("billing_month", month)
        .maybeSingle();

      let billing = existing;
      if (!billing) {
        const { data: created } = await db
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
        billing = created;
      }

      if (billing) {
        billingId = billing.id;
        const { data: pay } = await db
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
        paymentId = pay?.id ?? null;

        // payments 합산으로 paid_amount 재계산 (정산 페이지와 동일 로직)
        const { data: payRows } = await db
          .from("payments")
          .select("amount")
          .eq("billing_id", billing.id);
        const newPaid = (payRows || []).reduce(
          (s: number, p: { amount: number }) => s + p.amount,
          0,
        );
        const total = billing.total_amount || pr.amount;
        const newStatus = newPaid <= 0 ? "unpaid" : newPaid >= total ? "paid" : "partial";
        await db
          .from("billings")
          .update({
            paid_amount: newPaid,
            status: newStatus,
            paid_date: newStatus === "paid" ? payDate : billing.paid_date ?? null,
          })
          .eq("id", billing.id);
      }
    } catch {
      // 정산 반영 실패는 결제 성공 자체를 막지 않음 (관리자가 수동 보정 가능)
    }
  }

  await db
    .from("payment_requests")
    .update({
      status: "paid",
      payment_key: result.data.paymentKey,
      method: result.data.method,
      receipt_url: result.data.receipt?.url ?? null,
      paid_at: paidAtIso,
      billing_id: billingId,
      payment_id: paymentId,
    })
    .eq("id", pr.id);

  return NextResponse.json({ ok: true });
}
