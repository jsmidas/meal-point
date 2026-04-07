-- v22: payments 테이블에 입금자명, 은행명 추가
-- 기존 데이터는 NULL로 유지 (영향 없음)

ALTER TABLE payments ADD COLUMN IF NOT EXISTS depositor_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_name TEXT;
