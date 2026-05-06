-- ============================================
-- v24: inventory_logs 기반 단가 이력 시드
-- 기존 입고/판매 기록의 단가를 시점별로 company_price_history 에 시드.
-- 이로써:
--   - 매입가 모드의 매입처별 셀이 비어있던 문제 해소
--   - 판매가 모드의 시계 아이콘 모달에 거래 시점별 단가 이력이 풍부하게 표시됨
-- 멱등(idempotent): WHERE NOT EXISTS 로 동일 row 중복 방지. 여러 번 실행해도 안전.
-- ============================================

-- 1) 매입가 시드: inventory_logs(type='in')
INSERT INTO company_price_history (company_id, product_id, price_type, price, effective_from, notes)
SELECT DISTINCT il.company_id, il.product_id, 'cost', il.unit_price, il.log_date, '입고기록 시드'
FROM inventory_logs il
WHERE il.type = 'in'
  AND il.company_id IS NOT NULL
  AND il.product_id IS NOT NULL
  AND il.unit_price > 0
  AND NOT EXISTS (
    SELECT 1 FROM company_price_history h
    WHERE h.company_id = il.company_id
      AND h.product_id = il.product_id
      AND h.price_type = 'cost'
      AND h.effective_from = il.log_date
      AND h.price = il.unit_price
  );

-- 2) 판매가 시드: inventory_logs(type='out')
INSERT INTO company_price_history (company_id, product_id, price_type, price, effective_from, notes)
SELECT DISTINCT il.company_id, il.product_id, 'sell', il.unit_price, il.log_date, '출고기록 시드'
FROM inventory_logs il
WHERE il.type = 'out'
  AND il.company_id IS NOT NULL
  AND il.product_id IS NOT NULL
  AND il.unit_price > 0
  AND NOT EXISTS (
    SELECT 1 FROM company_price_history h
    WHERE h.company_id = il.company_id
      AND h.product_id = il.product_id
      AND h.price_type = 'sell'
      AND h.effective_from = il.log_date
      AND h.price = il.unit_price
  );

-- ============================================
-- 검증
-- ============================================
-- SELECT price_type, COUNT(*) FROM company_price_history GROUP BY price_type;
-- SELECT * FROM company_price_history ORDER BY effective_from DESC LIMIT 30;
