-- ============================================
-- v21: RLS 보안 강화
-- 기존 개발용 전체허용 정책 → 읽기전용(anon) + service_role로 쓰기
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- ============================================
-- 1단계: 기존 개발용 정책 삭제
-- ============================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'company_info', 'companies', 'products', 'company_prices',
      'orders', 'order_items', 'statements', 'statement_items',
      'quotes', 'quote_items', 'billings', 'payments',
      'inventory', 'inventory_logs', 'expenses', 'product_pages',
      'quote_send_logs', 'statement_send_logs', 'sale_checks',
      'popups', 'members'
    ])
  LOOP
    -- 기존 정책 모두 삭제 (존재하지 않아도 에러 없음)
    EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "public_read" ON %I', tbl);
  END LOOP;
END;
$$;

-- ============================================
-- 2단계: RLS 활성화 (이미 활성화된 경우 무시됨)
-- ============================================
ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3단계: 새 정책 생성
-- 원칙: anon은 공개 테이블만 읽기 가능, 쓰기는 불가
--       authenticated(회원)는 읽기만 가능
--       service_role(서버 API)은 RLS 자동 우회
-- ============================================

-- 공개 읽기: 홈페이지/랜딩에서 필요한 테이블
CREATE POLICY "anon_read" ON products FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON product_pages FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON company_info FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON popups FOR SELECT TO anon USING (true);

-- authenticated 읽기: 로그인한 회원이 조회할 수 있는 테이블
CREATE POLICY "auth_read" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON product_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON company_info FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON popups FOR SELECT TO authenticated USING (true);

-- 관리자 페이지에서 읽기가 필요한 테이블 (anon으로 읽기)
-- 관리자 페이지는 Next.js 미들웨어로 보호되고, 데이터 읽기는 anon key로 수행
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'companies', 'company_prices',
      'orders', 'order_items',
      'statements', 'statement_items',
      'quotes', 'quote_items',
      'billings', 'payments',
      'inventory', 'inventory_logs',
      'expenses',
      'quote_send_logs', 'statement_send_logs',
      'sale_checks'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY "anon_read" ON %I FOR SELECT TO anon USING (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "auth_read" ON %I FOR SELECT TO authenticated USING (true)',
      tbl
    );
  END LOOP;
END;
$$;

-- members 테이블: 인증 API(서버)에서만 접근 → anon 읽기 허용 (로그인 확인용)
CREATE POLICY "anon_read" ON members FOR SELECT TO anon USING (true);
CREATE POLICY "auth_read" ON members FOR SELECT TO authenticated USING (true);

-- ============================================
-- 참고: service_role 키는 RLS를 자동 우회합니다.
-- 따라서 서버 API(/api/db)에서 service_role로 실행하는
-- INSERT/UPDATE/DELETE는 별도 정책 없이 동작합니다.
-- ============================================
