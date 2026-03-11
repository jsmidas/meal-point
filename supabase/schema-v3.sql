-- ============================================
-- 밀포인트 3단계 DB 스키마 (견적서 + 월 정산/청구)
-- ============================================

-- 견적서
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE, -- 'QT-20260312-001'
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE, -- 견적 유효기간
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
  supply_amount INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 견적서 항목
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  specification TEXT,
  unit TEXT NOT NULL DEFAULT 'EA',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 월 정산/청구
CREATE TABLE billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_number TEXT NOT NULL UNIQUE, -- 'BL-202603-001'
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  billing_month TEXT NOT NULL, -- '2026-03' 형식
  total_supply INTEGER NOT NULL DEFAULT 0, -- 공급가액 합계
  total_tax INTEGER NOT NULL DEFAULT 0, -- 세액 합계
  total_amount INTEGER NOT NULL DEFAULT 0, -- 청구 합계
  paid_amount INTEGER NOT NULL DEFAULT 0, -- 입금액
  status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, partial, paid
  paid_date DATE, -- 완납일
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, billing_month)
);

-- 입금 이력
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT, -- 'bank_transfer', 'cash', 'card' 등
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거
CREATE TRIGGER set_updated_at_quotes
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_billings
  BEFORE UPDATE ON billings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 인덱스
CREATE INDEX idx_quotes_company ON quotes(company_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX idx_billings_company ON billings(company_id);
CREATE INDEX idx_billings_month ON billings(billing_month);
CREATE INDEX idx_billings_status ON billings(status);
CREATE INDEX idx_payments_billing ON payments(billing_id);
