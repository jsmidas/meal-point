-- ============================================
-- 밀포인트 2단계 DB 스키마 (주문 + 거래명세서)
-- ============================================

-- 주문
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE, -- 'ORD-20260312-001' 형식
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, shipped, delivered, cancelled
  total_amount INTEGER NOT NULL DEFAULT 0, -- 총 금액 (원)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 주문 상세 항목
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL, -- 주문 시점 상품명 스냅샷
  unit TEXT NOT NULL DEFAULT 'EA',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0, -- 단가 (원)
  amount INTEGER NOT NULL DEFAULT 0, -- 소계 = quantity * unit_price
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 거래명세서
CREATE TABLE statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_number TEXT NOT NULL UNIQUE, -- 'ST-20260312-001' 형식
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  statement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supply_amount INTEGER NOT NULL DEFAULT 0, -- 공급가액
  tax_amount INTEGER NOT NULL DEFAULT 0, -- 세액
  total_amount INTEGER NOT NULL DEFAULT 0, -- 합계
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 거래명세서 항목
CREATE TABLE statement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  specification TEXT, -- 규격
  unit TEXT NOT NULL DEFAULT 'EA',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거
CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_statements
  BEFORE UPDATE ON statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 인덱스
CREATE INDEX idx_orders_company ON orders(company_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_statements_company ON statements(company_id);
CREATE INDEX idx_statements_order ON statements(order_id);
CREATE INDEX idx_statement_items_statement ON statement_items(statement_id);
