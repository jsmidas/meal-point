import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_CACHE_HEADERS } from "@/lib/public-data";
import { todayKST } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 공개 화면 공통 정보: 로고 주소와 지금 노출할 팝업.
 * 회사 정보(company_info)에서는 로고만 내보낸다 — 계좌번호·직인 이미지 주소 등은 공개하지 않는다.
 */
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const today = todayKST();

  const [info, popups] = await Promise.all([
    db.from("company_info").select("logo_image_url").limit(1).maybeSingle(),
    db
      .from("popups")
      .select("id, title, content, image_url, link_url, sort_order")
      .eq("is_active", true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order("sort_order", { ascending: true }),
  ]);

  if (info.error) console.error("[public/site] 회사 정보 조회 실패", info.error.message);
  if (popups.error) console.error("[public/site] 팝업 조회 실패", popups.error.message);

  return NextResponse.json(
    {
      logo_image_url: info.data?.logo_image_url ?? null,
      popups: popups.data || [],
    },
    { headers: PUBLIC_CACHE_HEADERS },
  );
}
