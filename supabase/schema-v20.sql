-- v20: 판매 확인(체크박스) 테이블
CREATE TABLE IF NOT EXISTS sale_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, company_id)
);

ALTER TABLE sale_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_confirmations_all" ON sale_confirmations FOR ALL USING (true) WITH CHECK (true);
