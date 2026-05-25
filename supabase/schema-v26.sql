-- ============================================
-- v26: 정산 입금 분배 — payments.payment_group_id
-- 한 번의 송금을 여러 월별 청구(billings)에 나눠 충당할 때,
-- 같은 송금에서 분배된 payment 레코드들을 묶어주는 그룹 ID.
-- 예) 500만원 송금 → 2026-03 미수 420만 + 2026-04 미수 80만
--     payment row 2개 생성, payment_group_id 동일 (uuid)
-- ============================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_payments_group
  ON payments(payment_group_id)
  WHERE payment_group_id IS NOT NULL;

COMMENT ON COLUMN payments.payment_group_id IS
  '한 번의 송금이 여러 월별 청구에 분배될 때 묶어주는 그룹 ID. NULL이면 단일 분배(기존 입금).';

-- ============================================
-- 검증
-- ============================================
-- SELECT payment_group_id, COUNT(*), SUM(amount)
--   FROM payments
--  WHERE payment_group_id IS NOT NULL
--  GROUP BY payment_group_id
--  ORDER BY MIN(created_at) DESC LIMIT 10;
