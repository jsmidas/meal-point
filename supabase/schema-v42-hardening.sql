-- =========================================================
-- v42: 안정화·보안 보강 (2026-11-19)
--
-- 코드 쪽 수정(같은 날 배포)과 짝을 이루는 DB 변경이다. 데이터를 지우거나 바꾸지 않는다.
-- 여러 번 실행해도 안전하다(이미 적용된 항목은 건너뛴다).
--
--   1) 로그인·가입 시도 제한 기록 테이블 (auth_throttle)
--   2) 체험 사용권: 회원당 활성 1건만 허용
--   3) 상품 삭제 시 입출고 이력이 함께 지워지지 않도록 변경 (CASCADE → RESTRICT)
--   4) 아이디 대소문자만 다른 중복 가입 차단
--   5) 공개 키(anon)의 테이블 읽기 권한 전부 회수
--      — 공개 화면이 서버(/api/public/*)를 거치도록 바뀐 코드가 배포된 뒤에 실행할 것.
--        그 전에 실행하면 홈페이지의 상품·로고·팝업이 보이지 않는다.
-- =========================================================

-- ── 1) 로그인·가입 시도 제한 ──
-- 서버 인스턴스가 바뀌어도 실패 횟수가 유지되도록 DB에 기록한다.
-- 이 테이블이 없으면 서버는 인스턴스 메모리로 대신 센다(제한이 느슨해짐).
CREATE TABLE IF NOT EXISTS public.auth_throttle (
  key TEXT PRIMARY KEY,                 -- 예: login:<ip>|<아이디>, login-id:<아이디>, register:<ip>
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_throttle_updated ON public.auth_throttle(updated_at);
-- 정책을 두지 않는다 → 공개 키로는 접근 불가, 서버(service_role)만 읽고 쓴다
ALTER TABLE public.auth_throttle ENABLE ROW LEVEL SECURITY;

-- ── 2) 체험 사용권: 회원당 활성 1건 ──
-- 같은 회원이 동시에 신청해도 계정이 여러 개 배정되지 않게 한다.
-- 이미 활성 사용권이 2건 이상인 회원이 있으면 인덱스를 만들 수 없으므로 건너뛰고 알린다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.meal_trial_grants
    WHERE status = 'active'
    GROUP BY member_id HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE '건너뜀: 활성 체험 사용권이 2건 이상인 회원이 있습니다. 관리자 화면(체험 관리)에서 중복을 회수한 뒤 다시 실행하세요.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_grants_member_active
      ON public.meal_trial_grants(member_id) WHERE status = 'active';
  END IF;
END;
$$;

-- ── 3) 상품 삭제가 입출고 이력을 지우지 않도록 ──
-- inventory_logs.product_id 의 외래키가 ON DELETE CASCADE 라서, 상품을 지우면 그 상품의
-- 판매·입고 기록이 통째로 사라져 지난 달 정산·수불·손익이 바뀐다. RESTRICT 로 바꿔
-- 이력이 있는 상품은 DB 차원에서도 삭제되지 않게 한다(판매 중단으로 처리).
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.inventory_logs'::regclass
      AND con.contype = 'f'
      AND con.confrelid = 'public.products'::regclass
      AND att.attname = 'product_id'
      AND con.confdeltype <> 'r'          -- 이미 RESTRICT 면 건드리지 않는다
  LOOP
    EXECUTE format('ALTER TABLE public.inventory_logs DROP CONSTRAINT %I', c.conname);
    EXECUTE 'ALTER TABLE public.inventory_logs
             ADD CONSTRAINT inventory_logs_product_id_fkey
             FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT';
  END LOOP;
END;
$$;

-- ── 4) 아이디 대소문자 중복 차단 ──
-- daham01 과 Daham01 이 별개 계정으로 가입되는 것을 막는다.
-- 이미 대소문자만 다른 아이디가 있으면 인덱스를 만들 수 없으므로 건너뛰고 알린다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.members
    WHERE login_id IS NOT NULL
    GROUP BY lower(login_id) HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE '건너뜀: 대소문자만 다른 아이디가 이미 있습니다. 정리한 뒤 다시 실행하세요.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_members_login_id_lower
      ON public.members (lower(login_id)) WHERE login_id IS NOT NULL;
  END IF;
END;
$$;

-- ── 5) 공개 키의 테이블 읽기 권한 전부 회수 ──
-- v35 에서 공개 화면용으로 남겨 둔 4개 테이블도 닫는다. 이 테이블들은 전 컬럼이 읽혀서
-- 상품 매입 원가, 미게시 상품, 회사 계좌번호·직인 이미지 주소까지 누구나 조회할 수 있었다.
-- 공개 화면은 이제 서버가 공개 항목만 골라 내보낸다(/api/public/*).
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['products', 'product_pages', 'company_info', 'popups'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_read" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "auth_read" ON public.%I', tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END;
$$;

-- 확인용: public 스키마에 남은 정책 목록 (아무것도 나오지 않으면 공개 키로 읽을 수 있는 테이블이 없다)
-- SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2;
