-- =========================================================
-- v39: 자가소비 금액 정산용 매입 단가 (2026-10-23)
--
-- inventory_logs.unit_price 는 판매 단가(다함푸드 업체 단가), cost_price 는 기록 시점의 매입 단가.
-- 자가소비(type='self')를 판매가 기준·매입가 기준 두 금액으로 집계하기 위해 둘 다 행에 박아 둔다.
-- (상품 매입가가 나중에 바뀌어도 지난 달 정산액이 흔들리지 않도록 스냅샷)
-- =========================================================

ALTER TABLE public.inventory_logs ADD COLUMN IF NOT EXISTS cost_price INT NOT NULL DEFAULT 0;

-- 기존 자가소비 기록: 상품의 현재 매입가로 채움
UPDATE public.inventory_logs l
SET cost_price = COALESCE(p.cost_price, 0)
FROM public.products p
WHERE l.product_id = p.id AND l.type = 'self' AND l.cost_price = 0;
