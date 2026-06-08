import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalSession } from "@/lib/auth/portal";

/**
 * 포털 발주 화면용 상품 목록 + 이 거래처에 적용되는 단가.
 * 단가는 서버에서 확정한다 (거래처 단가 > 기본 판매가). 클라이언트는 단가를 정할 수 없다.
 */
export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 401 });
  }

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: products }, { data: prices }] = await Promise.all([
    (supabase.from("products") as any)
      .select("id, name, unit, selling_price")
      .eq("is_active", true)
      .order("name"),
    (supabase.from("company_prices") as any)
      .select("product_id, custom_price")
      .eq("company_id", session.companyId),
  ]);

  const priceMap: Record<string, number> = {};
  for (const row of prices || []) {
    priceMap[row.product_id] = Number(row.custom_price);
  }

  const list = (products || []).map(
    (p: { id: string; name: string; unit: string; selling_price: number }) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      price: priceMap[p.id] ?? p.selling_price ?? 0,
    }),
  );

  return NextResponse.json({ ok: true, products: list });
}
