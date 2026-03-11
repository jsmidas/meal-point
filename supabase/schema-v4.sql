-- ============================================
-- 4단계: 손익 리포트 + 재고 관리
-- ============================================

-- 재고 테이블
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  current_stock INT NOT NULL DEFAULT 0,
  safety_stock INT NOT NULL DEFAULT 10,
  last_in_date DATE,
  last_out_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id)
);

-- 입출고 로그 테이블
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out', 'adjust')),
  quantity INT NOT NULL,
  reason TEXT,
  reference_id UUID,
  reference_type VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 비용(매입) 테이블
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category VARCHAR(50) NOT NULL DEFAULT '매입',
  description TEXT NOT NULL,
  amount INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 재고 updated_at 자동 갱신 트리거
CREATE TRIGGER set_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 인덱스
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_type ON inventory_logs(type);
CREATE INDEX idx_inventory_logs_created ON inventory_logs(created_at);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- 각 상품에 대해 초기 재고 레코드 생성 (기존 상품용)
INSERT INTO inventory (product_id, current_stock, safety_stock)
SELECT id, 0, 10 FROM products
ON CONFLICT (product_id) DO NOTHING;
