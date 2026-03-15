-- v10: 거래처별 상품 단가 테이블
CREATE TABLE IF NOT EXISTS company_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, product_id)
);

-- RLS
ALTER TABLE company_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for company_prices" ON company_prices FOR ALL USING (true) WITH CHECK (true);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_company_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_prices_updated_at
  BEFORE UPDATE ON company_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_company_prices_updated_at();
