-- =========================================================
-- v37: 재고 수불 유형에 '자가소비(self)' 추가 (2026-10-20)
--
-- 다함푸드가 가져간 물량 중 판매(청구)가 아닌 자가소비분을 별도 유형으로 기록한다.
--   in     : 입고(매입)            → 재고 +
--   out    : 출고(판매)            → 재고 - , 매출·청구·명세서·손익에 포함
--   self   : 자가소비              → 재고 - , 매출·청구·명세서·손익에서 제외
--   adjust : 재고 조정(실사 수량)  → 재고를 quantity 값으로 맞춤
-- 기존 판매 기록을 자가소비로 돌리려면 type 만 'out' → 'self' 로 바꾸면 된다
-- (재고는 이미 차감되어 있으므로 수량 변동 없음).
-- =========================================================

ALTER TABLE public.inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_type_check;
ALTER TABLE public.inventory_logs
  ADD CONSTRAINT inventory_logs_type_check
  CHECK (type IN ('in', 'out', 'self', 'adjust'));
