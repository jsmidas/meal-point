-- =========================================================
-- v38: 변경 이력(감사 로그) + 회원 관리자 권한 (2026-10-20)
--
-- 1) audit_logs: 누가(세션) 어느 테이블의 어떤 행을 어떻게 바꿨는지 기록.
--    서버 API(/api/db, /api/admin/accounts, /api/auth)에서만 service_role 로 쓴다.
--    RLS 켜고 정책 없음 → anon/authenticated 접근 불가, 관리자 화면은 /api/sb 프록시(GET)로 읽는다.
-- 2) members.role = 'admin' 인 회원은 로그인 시 관리자 세션(role admin)을 받는다.
--    (환경변수 ADMIN_ID 계정과 동일 권한. daham01·daham02 — 다함푸드 직원)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_role  TEXT NOT NULL,            -- super_admin | admin | company | member | anonymous
  actor_id    UUID,                     -- members.id (환경변수 관리자는 NULL)
  actor_login TEXT,                     -- 로그인 아이디
  actor_name  TEXT,
  action      TEXT NOT NULL,            -- insert | update | delete | upsert | login | 기타
  table_name  TEXT NOT NULL,            -- 대상 테이블 (로그인 등은 'auth')
  record_id   TEXT,                     -- 대상 행 id (여러 행이면 첫 행)
  row_count   INT NOT NULL DEFAULT 1,
  before_data JSONB,                    -- update/delete 전 행(들)
  after_data  JSONB,                    -- insert/update 후 행(들)
  filters     JSONB,                    -- update/delete 조건
  ip          TEXT,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON public.audit_logs(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_login, at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- 정책 없음: service_role 만 읽기/쓰기

-- 다함푸드 직원 계정을 관리자로
UPDATE public.members SET role = 'admin' WHERE login_id IN ('daham01', 'daham02');
