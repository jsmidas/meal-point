-- =========================================================
-- v44: 단가표에 박스 금액을 함께 저장 (2026-11-19)
--
-- 단가는 개당 단가(custom_price, selling_price)로만 저장돼 있어서, 박스 금액은 항상
-- "개당 단가 × 입수"로 계산됐다. 박스 50,000원(300개입)처럼 개당 단가로 나누어떨어지지 않는
-- 금액은 단가표에 넣을 방법이 없어 판매 등록 때마다 손으로 고쳐야 했다.
--
-- 개당 단가는 그대로 두고, 박스 금액을 따로 저장한다.
--   - 값이 있으면 박스 단위 판매·명세서·주문·견적의 박스 단가로 그 금액을 쓴다.
--   - NULL 이면 예전처럼 개당 단가 × 입수. (기존 단가는 모두 NULL → 변화 없음)
--   - 낱개 판매는 항상 개당 단가를 쓴다.
--
-- 실행 순서: 이 SQL 을 먼저 실행한 뒤에 새 코드를 배포한다.
--   (컬럼만 먼저 추가된 상태에서는 예전 코드도 그대로 동작한다.)
-- =========================================================

-- 거래처별 단가: 지금 적용 중인 박스 금액
ALTER TABLE public.company_prices ADD COLUMN IF NOT EXISTS box_price INT;
-- 단가 이력: 그 적용일부터의 박스 금액 (판매가 이력에만 쓴다)
ALTER TABLE public.company_price_history ADD COLUMN IF NOT EXISTS box_price INT;
-- 상품 기본 판매가의 박스 금액
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS selling_box_price INT;

COMMENT ON COLUMN public.company_prices.box_price IS
  '박스 금액(원). NULL 이면 custom_price * 상품 입수.';
COMMENT ON COLUMN public.company_price_history.box_price IS
  '박스 금액(원). NULL 이면 price * 상품 입수.';
COMMENT ON COLUMN public.products.selling_box_price IS
  '기본 박스 판매가(원). NULL 이면 selling_price * box_quantity.';
