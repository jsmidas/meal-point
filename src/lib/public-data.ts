/**
 * 공개 화면(홈페이지·카탈로그·상품 상세)에 내보내는 데이터의 범위.
 *
 * 공개 화면은 브라우저에서 DB를 직접 읽지 않고 /api/public/* 를 거친다.
 * 브라우저가 테이블을 직접 읽으면 화면에 쓰지 않는 컬럼(매입 원가, 계좌번호, 직인 이미지 주소 등)과
 * 미게시 행까지 누구나 조회할 수 있기 때문이다. 여기 적힌 컬럼·조건만 밖으로 나간다.
 */

/** 공개해도 되는 상품 컬럼 (매입 원가 cost_price 는 제외) */
export const PUBLIC_PRODUCT_COLUMNS =
  "id, name, category, unit, box_quantity, selling_price, description, image_url, is_active, is_published";

/** /api/public/products 가 돌려주는 상품 한 건 */
export interface PublicProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  box_quantity: number;
  selling_price: number;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  is_published?: boolean | null;
}

/** 공개 응답 캐시: CDN 에서 1분, 그 뒤 5분까지는 이전 값을 보여 주며 갱신 */
export const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

/** 미게시 상품 제외. is_published 컬럼이 없는 예전 DB에서는 전부 게시된 것으로 본다. */
export function isPublished(p: { is_published?: boolean | null }): boolean {
  return p.is_published !== false;
}
