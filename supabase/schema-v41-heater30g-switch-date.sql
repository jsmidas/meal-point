-- =========================================================
-- v41: 발열제 30g 매입가 165원 전환일 2026-10-01 → 2026-08-01 (2026-10-23, 사용자 지정)
-- =========================================================
DO $$
DECLARE pid UUID;
BEGIN
  SELECT id INTO pid FROM public.products WHERE name = '발열제 30g' LIMIT 1;
  IF pid IS NULL THEN RAISE EXCEPTION '발열제 30g 상품을 찾을 수 없습니다'; END IF;

  UPDATE public.company_price_history
     SET effective_from = '2026-08-01', notes = '수입 발열제로 전환'
   WHERE product_id = pid AND price_type = 'cost' AND price = 165 AND effective_from = '2026-10-01';
  UPDATE public.company_price_history
     SET notes = '국산 발열제 매입가 (2026-07까지)'
   WHERE product_id = pid AND price_type = 'cost' AND price = 320 AND effective_from = '1900-01-01';

  UPDATE public.inventory_logs SET cost_price = 320 WHERE product_id = pid AND type = 'self' AND log_date <  '2026-08-01';
  UPDATE public.inventory_logs SET cost_price = 165 WHERE product_id = pid AND type = 'self' AND log_date >= '2026-08-01';
END $$;
