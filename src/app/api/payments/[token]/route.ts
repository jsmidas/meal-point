import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTossClientKey } from "@/lib/toss";

/**
 * 거래처 결제 페이지용 공개 조회. token 으로만 접근 가능하며
 * 카드/민감 정보는 포함하지 않는다. (payment_requests 는 RLS 차단 상태)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pr } = await (admin as any)
    .from("payment_requests")
    .select(
      "order_name, amount, customer_name, status, expires_at, toss_order_id",
    )
    .eq("token", token)
    .maybeSingle();

  if (!pr) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let status = pr.status as string;
  if (status === "pending" && new Date(pr.expires_at).getTime() < Date.now()) {
    status = "expired";
  }

  return NextResponse.json({
    data: {
      order_name: pr.order_name,
      amount: pr.amount,
      customer_name: pr.customer_name,
      status,
      toss_order_id: pr.toss_order_id,
      client_key: getTossClientKey(),
    },
  });
}
