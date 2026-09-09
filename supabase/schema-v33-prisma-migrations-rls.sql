-- v33: Supabase 보안 경고 해소 — public._prisma_migrations RLS 미활성
-- 이 프로젝트는 Prisma를 쓰지 않는다(package.json에 @prisma/* 없음, prisma/ 디렉터리 없음).
-- _prisma_migrations 는 과거 흔적으로 남은 테이블이며, PostgREST에 노출된 채
-- RLS가 꺼져 있어 anon 키만으로 마이그레이션 이력(파일명·체크섬·시각)이 읽힌다.
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 0단계: 실행 전 확인 (먼저 이것만 돌려보고 결과를 볼 것)
-- ============================================
-- SELECT * FROM public._prisma_migrations ORDER BY finished_at DESC;
-- → 결과가 비었거나, 이 프로젝트와 무관한 옛 마이그레이션만 있으면 2단계(삭제) 권장.

-- ============================================
-- 1단계: RLS 활성화 (무손실 · 기본 권장)
-- 정책을 하나도 만들지 않으므로 anon/authenticated의 모든 접근이 차단된다.
-- service_role(createAdminClient)은 RLS를 우회하므로 영향 없음.
-- ============================================
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2단계(선택): 테이블 자체 제거
-- Prisma를 앞으로도 쓰지 않을 것이 확실할 때만. 되돌릴 수 없다.
-- 1단계를 이미 실행했다면 경고는 사라진 상태이므로 급하지 않다.
-- ============================================
-- DROP TABLE IF EXISTS public._prisma_migrations;

-- ============================================
-- 3단계: 검증 — public 스키마에서 RLS가 꺼진 테이블이 남았는지 전수 확인
-- ============================================
-- SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
-- ORDER BY 1;
