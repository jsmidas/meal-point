import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_CACHE_HEADERS, PUBLIC_PRODUCT_COLUMNS, isPublished } from "@/lib/public-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 공개 상품 목록 (랜딩·카탈로그용).
 * 판매 중이고 홈페이지에 게시된 상품만, 공개 컬럼만 돌려준다.
 * pages: 발행된 상세페이지가 있는 상품의 대표 이미지(hero_images).
 */
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const [prods, pages] = await Promise.all([
    db.from("products").select(PUBLIC_PRODUCT_COLUMNS).eq("is_active", true).order("name"),
    db.from("product_pages").select("product_id, hero_images").eq("is_published", true),
  ]);

  if (prods.error) {
    console.error("[public/products] 상품 조회 실패", prods.error.message);
    return NextResponse.json({ products: [], pages: [], error: "상품을 불러오지 못했습니다." }, { status: 500 });
  }

  const products = (prods.data || []).filter(isPublished);
  const publishedIds = new Set(products.map((p: { id: string }) => p.id));
  const pageRows = (pages.data || []).filter((pg: { product_id: string }) => publishedIds.has(pg.product_id));

  return NextResponse.json({ products, pages: pageRows }, { headers: PUBLIC_CACHE_HEADERS });
}
