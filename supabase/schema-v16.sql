-- v16: billings 테이블에 세금계산서 필드 추가
ALTER TABLE billings
  ADD COLUMN IF NOT EXISTS tax_invoice_issued BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_invoice_date DATE,
  ADD COLUMN IF NOT EXISTS tax_invoice_number TEXT;
