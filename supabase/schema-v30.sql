-- ============================================
-- v30: 포털 발주 출처 추적 — orders 확장
-- 거래처 발주 계정(/portal)에서 들어온 발주와 관리자가 직접 만든 발주를 구분.
-- 포털 발주는 status='pending'(승인대기)로 들어와 관리자가 확인·확정한다.
-- ============================================

-- 발주를 넣은 계정(members) + 출처
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'admin';  -- 'admin' | 'portal'

CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);

-- ============================================
-- 검증
-- ============================================
-- 포털로 들어온 승인대기 발주
-- SELECT order_number, company_id, status, created_at
--   FROM orders WHERE source = 'portal' AND status = 'pending'
--  ORDER BY created_at DESC;
