-- ============================================
-- v23: 거래처별·날짜별 단가 이력 테이블
-- 유가 등 외부 변동에 따라 입고가/판매가가 시점별로 달라지는 경우를 추적.
-- 기존 테이블(products, company_prices, inventory_logs)은 손대지 않음.
--   - inventory_logs.unit_price 는 이미 거래 시점 단가가 박혀 있으므로
--     과거 매출/손익 계산은 이 마이그레이션의 영향을 받지 않습니다.
--   - company_prices 는 "현재 적용 판매가 캐시"로 그대로 유지.
--   - products.cost_price 는 "기본 입고가"로 그대로 유지.
--
-- 적용 방법:
--   Supabase SQL Editor에서 이 파일 전체를 실행. 멱등(idempotent)이라 여러 번 실행해도 안전.
-- ============================================

CREATE TABLE IF NOT EXISTS company_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL 허용: 매입가 기본값(매입처 무관)이나 판매가 기본값을 표현할 때 사용
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_type TEXT NOT NULL CHECK (price_type IN ('sell', 'cost')),
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 조회 인덱스: 특정 거래처/상품/타입의 effective_from <= 거래일자 중 최신 1건
CREATE INDEX IF NOT EXISTS idx_cph_lookup
  ON company_price_history(company_id, product_id, price_type, effective_from DESC);

-- ============================================
-- RLS: anon/authenticated 읽기, 쓰기는 service_role(서버 API) 경유
-- ============================================
ALTER TABLE company_price_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_price_history' AND policyname = 'anon_read'
  ) THEN
    CREATE POLICY "anon_read" ON company_price_history FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_price_history' AND policyname = 'auth_read'
  ) THEN
    CREATE POLICY "auth_read" ON company_price_history FOR SELECT TO authenticated USING (true);
  END IF;
END;
$$;

-- ============================================
-- 기존 데이터 시드 (effective_from = 1900-01-01)
-- 이 시드 덕분에 새 화면이 어떤 거래일자에 대해서도 항상 단가를 찾을 수 있고,
-- 이력이 누적되기 전에도 기존 화면과 동일한 가격을 반환합니다.
-- ============================================

-- 1) 판매가 시드: company_prices 의 현재 단가 → sell history
INSERT INTO company_price_history (company_id, product_id, price_type, price, effective_from, notes)
SELECT cp.company_id, cp.product_id, 'sell', cp.custom_price, '1900-01-01'::date, '초기 시드 (company_prices 마이그레이션)'
FROM company_prices cp
WHERE NOT EXISTS (
  SELECT 1 FROM company_price_history h
  WHERE h.company_id = cp.company_id
    AND h.product_id = cp.product_id
    AND h.price_type = 'sell'
    AND h.effective_from = '1900-01-01'::date
);

-- 2) 판매가 기본값 시드: products.selling_price → sell history (company_id NULL)
--    거래처별 단가가 없는 상품에 대해 fallback 으로 사용.
INSERT INTO company_price_history (company_id, product_id, price_type, price, effective_from, notes)
SELECT NULL, p.id, 'sell', p.selling_price, '1900-01-01'::date, '초기 시드 (products.selling_price 기본 판매가)'
FROM products p
WHERE p.selling_price > 0
  AND NOT EXISTS (
    SELECT 1 FROM company_price_history h
    WHERE h.company_id IS NULL
      AND h.product_id = p.id
      AND h.price_type = 'sell'
      AND h.effective_from = '1900-01-01'::date
  );

-- 3) 입고가 기본값 시드: products.cost_price → cost history (company_id NULL)
INSERT INTO company_price_history (company_id, product_id, price_type, price, effective_from, notes)
SELECT NULL, p.id, 'cost', p.cost_price, '1900-01-01'::date, '초기 시드 (products.cost_price 기본 입고가)'
FROM products p
WHERE p.cost_price > 0
  AND NOT EXISTS (
    SELECT 1 FROM company_price_history h
    WHERE h.company_id IS NULL
      AND h.product_id = p.id
      AND h.price_type = 'cost'
      AND h.effective_from = '1900-01-01'::date
  );

-- ============================================
-- 검증용 쿼리 (실행 후 결과 확인)
-- ============================================
-- SELECT price_type, COUNT(*) FROM company_price_history GROUP BY price_type;
-- SELECT * FROM company_price_history ORDER BY product_id, price_type, effective_from DESC LIMIT 30;
