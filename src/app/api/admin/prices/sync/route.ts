import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/guard";
import { syncSellPrices } from "@/lib/price-schedule";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * "지금 적용 중인 판매 단가"(company_prices)를 단가 이력의 적용일 기준으로 맞춘다. 관리자 전용.
 *  - body.pairs 가 있으면 그 거래처·상품 조합만 (단가 저장 직후 호출)
 *  - 없으면 적용일이 된 예약 단가만 반영 (단가 관리 화면 진입 시 호출 — 자정 예약 작업의 보조)
 */
export async function POST(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "관리자 권한이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawPairs: unknown[] = body && Array.isArray(body.pairs) ? body.pairs.slice(0, 2000) : [];
  const pairs = rawPairs
    .map((p) => {
      const o = p as { companyId?: unknown; productId?: unknown };
      return { companyId: String(o?.companyId || ""), productId: String(o?.productId || "") };
    })
    .filter((p) => UUID.test(p.companyId) && UUID.test(p.productId));

  const admin = createAdminClient();
  try {
    const result = await syncSellPrices(admin, pairs.length > 0 ? pairs : undefined);
    if (result.changed > 0) {
      await writeAudit(
        admin,
        session,
        {
          action: "update",
          table: "company_prices",
          after: { reason: pairs.length > 0 ? "단가 저장 반영" : "적용일이 된 예약 단가 반영", changed: result.changed },
          rowCount: result.changed,
        },
        request,
      );
    }
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (err) {
    console.error("[admin/prices/sync]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "단가 반영 중 오류가 발생했습니다." }, { status: 500 });
  }
}
