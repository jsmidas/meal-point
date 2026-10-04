-- =========================================================
-- v35: 보안 잠금 (2026-10-04)
--
-- 배경: anon 키(홈페이지에 포함된 공개 키)로 거래처·입금·명세서·회원(비밀번호 해시) 등
--       업무 테이블 전체가 읽혔고, 일부 테이블과 logos 스토리지는 쓰기까지 열려 있었다.
-- 조치:
--   1) anon / authenticated 읽기 정책을 공개 테이블(products, product_pages, company_info, popups)만 남기고 제거
--   2) 개발 초기의 "Allow all" 전체 허용 정책 제거
--   3) logos 스토리지의 익명 쓰기(INSERT/UPDATE/DELETE) 정책 제거 — 업로드는 서버 프록시(service_role) 경유
--
-- 관리자 화면의 읽기·업로드는 /api/sb 프록시(서명된 관리자 세션 + service_role)로 처리한다.
-- service_role 은 RLS 를 우회하므로 서버 API 는 영향이 없다.
-- =========================================================

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'billings', 'companies', 'company_price_history', 'company_prices',
      'expenses', 'inventory', 'inventory_logs', 'members',
      'order_items', 'orders', 'payments',
      'quote_items', 'quote_send_logs', 'quotes',
      'sale_checks', 'statement_items', 'statement_send_logs', 'statements'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_read" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "auth_read" ON public.%I', tbl);
  END LOOP;
END;
$$;

-- 개발 초기 전체 허용 정책 제거
DROP POLICY IF EXISTS "Allow all for company_prices" ON public.company_prices;
DROP POLICY IF EXISTS "Allow all for quote_send_logs" ON public.quote_send_logs;
DROP POLICY IF EXISTS "Allow all for statement_send_logs" ON public.statement_send_logs;
DROP POLICY IF EXISTS "sale_confirmations_all" ON public.sale_confirmations;

-- 모든 업무 테이블에 RLS 가 켜져 있는지 보장 (정책이 없으면 anon/authenticated 는 접근 불가)
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END;
$$;

-- 스토리지: 공개 읽기만 유지, 익명 쓰기 제거
DROP POLICY IF EXISTS "Allow upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow update logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth update logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete logos" ON storage.objects;

-- 확인용: 남은 정책 목록
-- SELECT schemaname||'.'||tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY 1,2;
