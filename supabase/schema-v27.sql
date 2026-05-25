-- ============================================
-- v27: 명세서 단위 입금 매칭 — payments.statement_id
-- 거래명세서(거래/배송 단위) 1건씩 미결을 추적하기 위해
-- payments에 명세서 참조를 추가한다.
--
-- 규칙:
--  - billing_id 는 그대로 필수(월 단위 합산용)
--  - statement_id 는 NULL 허용
--    · NULL: 청구 단위 충당 (기존 호환, "분류 미확정" 입금)
--    · 값 있음: 명세서 단위 충당 (정확한 트래킹)
--  - 같은 송금 분배(payment_group_id)와 자유롭게 조합 가능
-- ============================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS statement_id UUID REFERENCES statements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_statement
  ON payments(statement_id)
  WHERE statement_id IS NOT NULL;

COMMENT ON COLUMN payments.statement_id IS
  '명세서 단위 충당 트래킹용. NULL이면 청구 단위 충당(분류 미확정).';

-- ============================================
-- 검증
-- ============================================
-- 명세서별 미결액 (예: 특정 거래처)
-- SELECT s.id, s.statement_number, s.statement_date, s.total_amount,
--        COALESCE(SUM(p.amount), 0) AS paid,
--        s.total_amount - COALESCE(SUM(p.amount), 0) AS outstanding
--   FROM statements s
--   LEFT JOIN payments p ON p.statement_id = s.id
--  WHERE s.company_id = '...'
--  GROUP BY s.id
--  ORDER BY s.statement_date;
