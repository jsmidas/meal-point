-- =========================================================
-- v40: 발열제 30g 매입가 이력 정리 (2026-10-23)
--
-- 사용자 확인: "이전에는 320원이 맞고, 지금은 165원" (수입 발열제로 전환).
-- 기존 이력은 2026-07-13 같은 날 320/165/320 세 건 + 2026-08-31 '기본가 복귀' 0원 행이 섞여 있어
-- 판매일 기준 원가 계산이 흔들렸다. 320원(1900-01-01~) → 165원(2026-10-01~) 두 건으로 정리한다.
-- 전환일은 수입 발열제 상세를 기존 30g 상품에 적용한 2026-10-04 가 속한 달의 1일로 잡았다.
-- 자가소비(self) 기록의 cost_price 스냅샷도 같은 기준으로 맞춘다.
-- =========================================================

DO $$
DECLARE pid UUID;
BEGIN
  SELECT id INTO pid FROM public.products WHERE name = '발열제 30g' LIMIT 1;
  IF pid IS NULL THEN RAISE EXCEPTION '발열제 30g 상품을 찾을 수 없습니다'; END IF;

  DELETE FROM public.company_price_history WHERE product_id = pid AND price_type = 'cost';

  INSERT INTO public.company_price_history (product_id, price_type, price, effective_from, notes)
  VALUES
    (pid, 'cost', 320, '1900-01-01', '국산 발열제 매입가 (2026-09까지)'),
    (pid, 'cost', 165, '2026-10-01', '수입 발열제로 전환');

  -- 자가소비 스냅샷 매입가 재계산
  UPDATE public.inventory_logs SET cost_price = 320
   WHERE product_id = pid AND type = 'self' AND log_date < '2026-10-01';
  UPDATE public.inventory_logs SET cost_price = 165
   WHERE product_id = pid AND type = 'self' AND log_date >= '2026-10-01';
END $$;
