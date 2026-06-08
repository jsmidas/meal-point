-- ============================================
-- v31: 금액 컬럼 INTEGER → BIGINT (정수 오버플로 해결)
-- PostgreSQL integer 최대값은 2,147,483,647(약 21.4억)인데,
-- 급식/식자재는 대량발주·월합계에서 이를 넘어 "value ... is out of range
-- for type integer" 오류가 발생한다. 모든 금액/단가 컬럼을 bigint(약 922경)로 확장.
-- (quantity 등 수량 컬럼은 그대로 integer 유지 — 현실적으로 21억 미만)
--
-- 동적 변환: 컬럼명이 amount/price/supply/tax/cost 를 포함하는 public 스키마의
-- integer 컬럼을 모두 bigint 로. 나중 마이그레이션으로 추가된 컬럼
-- (payment_requests.amount, company_price_history.cost 등)까지 빠짐없이 처리.
-- DEFAULT/NOT NULL/CHECK 제약은 타입 변경 시 보존된다.
-- ============================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'integer'
      AND (
        column_name LIKE '%amount%' OR
        column_name LIKE '%price%'  OR
        column_name LIKE '%supply%' OR
        column_name LIKE '%tax%'    OR
        column_name LIKE '%cost%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I TYPE bigint',
      r.table_name, r.column_name
    );
    RAISE NOTICE 'bigint 변환: %.%', r.table_name, r.column_name;
  END LOOP;
END $$;

-- ============================================
-- 검증
-- ============================================
-- 아직 integer로 남은 금액 컬럼이 있는지 (없어야 정상)
-- SELECT table_name, column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema='public' AND data_type='integer'
--    AND (column_name LIKE '%amount%' OR column_name LIKE '%price%'
--         OR column_name LIKE '%supply%' OR column_name LIKE '%tax%'
--         OR column_name LIKE '%cost%');
