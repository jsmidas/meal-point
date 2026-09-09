-- v34: 상품 홈페이지 게시 여부 (is_published)
-- 판매는 하지만 홈페이지(랜딩 상품 섹션·상품 카탈로그·상품 상세)에는 노출하지 않는
-- 상품을 구분한다. is_active(판매중/중단)와 별개 축이며, 견적·주문 등 관리자 화면에는
-- 영향이 없다. 기본값 true 이므로 기존 상품은 모두 게시 상태로 유지된다.
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN products.is_published IS '홈페이지 게시 여부 (false면 판매는 하되 홈페이지에 노출하지 않음)';

-- (선택) 특정 상품을 바로 미게시로 전환하려면 예시처럼 실행
-- UPDATE products SET is_published = false WHERE name = '다함 2도 인쇄필름';
