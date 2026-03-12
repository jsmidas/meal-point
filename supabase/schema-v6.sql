-- ============================================
-- 6단계: 재고 수불 개선 - 입출고 시 거래처 연결
-- ============================================

-- inventory_logs에 company_id 추가 (매입처/판매처)
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS unit_price INT DEFAULT 0;
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS log_date DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_inventory_logs_company ON inventory_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_date ON inventory_logs(log_date);
