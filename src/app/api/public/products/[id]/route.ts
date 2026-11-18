import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_CACHE_HEADERS, PUBLIC_PRODUCT_COLUMNS, isPublished } from "@/lib/public-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 공개 상품 상세. 홈페이지에 게시된 상품만, 공개 컬럼만 돌려준다.
 * page: 발행된 상세페이지(없으면 null).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ product: null, page: null }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { data: product, error } = await db
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[public/products/id] 상품 조회 실패", error.message);
    return NextResponse.json({ product: null, page: null, error: "상품을 불러오지 못했습니다." }, { status: 500 });
  }
  // 미게시 상품은 주소를 직접 알아도 볼 수 없다
  if (!product || !isPublished(product)) {
    return NextResponse.json({ product: null, page: null }, { status: 404 });
  }

  const { data: page } = await db
    .from("product_pages")
    .select("*")
    .eq("product_id", id)
    .eq("is_published", true)
    .maybeSingle();

  return NextResponse.json({ product, page: page || null }, { headers: PUBLIC_CACHE_HEADERS });
}
