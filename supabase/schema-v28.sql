-- ============================================
-- v28: companies.biz_number UNIQUE 제약 완화
-- 같은 사업자번호라도 상호명이 다르면 별도 거래처로 등록 가능하도록 변경.
-- (예: 다함푸드 / 다함푸드(2호점), 또는 동일 사업자를 판매처·매입처로 분리 등록)
-- 전역 UNIQUE(biz_number) → 복합 UNIQUE(biz_number, name) 로 교체.
-- 사업자번호+상호명이 완전히 동일한 실수 중복은 여전히 차단.
-- ============================================

-- 1) 기존 전역 UNIQUE 제약 제거 (inline UNIQUE 의 Postgres 기본 제약명)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_biz_number_key;

-- 2) (사업자번호, 상호명) 복합 UNIQUE 추가
ALTER TABLE companies
  ADD CONSTRAINT companies_biz_number_name_key UNIQUE (biz_number, name);

-- ============================================
-- 검증
-- ============================================
-- 같은 biz_number, 다른 name → 등록 가능
-- 같은 biz_number, 같은 name → 23505 unique_violation
-- SELECT biz_number, name, COUNT(*) FROM companies GROUP BY biz_number, name HAVING COUNT(*) > 1;
