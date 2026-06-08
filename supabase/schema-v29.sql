-- ============================================
-- v29: 거래처(판매처) 발주 계정 — members 확장
-- 관리자가 거래처별 발주 계정을 발급하고, 그 계정으로 로그인하면
-- 업체 전용 포털(/portal)에서 직접 발주를 넣을 수 있도록 권한 기반 구조 도입.
--
-- 관계: 거래처 1 : 계정 N
--   - members.company_id → companies.id (한 거래처에 여러 담당자 계정 가능)
--   - members.role 로 권한 구분: 'admin' | 'company' | 'member'
--     · company : 자기 거래처 발주만 (포털 사용자)
--     · member  : 기존 일반 회원 (호환)
-- ============================================

-- 1) members 에 거래처 연결 + 권한 컬럼 추가
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- 2) 조회 인덱스 (거래처별 계정 목록, 권한 필터)
CREATE INDEX IF NOT EXISTS idx_members_company ON members(company_id);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);

-- ============================================
-- 검증
-- ============================================
-- 거래처별 발주 계정 목록
-- SELECT m.login_id, m.name, m.role, m.is_active, c.name AS company_name
--   FROM members m
--   LEFT JOIN companies c ON c.id = m.company_id
--  WHERE m.role = 'company'
--  ORDER BY c.name, m.login_id;
