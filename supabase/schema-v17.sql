-- v17: 판매 캘린더 체크박스 상태 저장
CREATE TABLE IF NOT EXISTS sale_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date DATE NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  checked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sale_date, company_id)
);

CREATE INDEX IF NOT EXISTS idx_sale_checks_date ON sale_checks(sale_date);
