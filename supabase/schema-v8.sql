-- v8: companies 테이블에 company_type 추가 (customer/supplier/both)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT 'customer';
-- company_type: 'customer' (판매처/거래처), 'supplier' (매입처/공급업체), 'both' (양쪽)

COMMENT ON COLUMN companies.company_type IS '거래처 유형: customer(판매처), supplier(매입처), both(양쪽)';
