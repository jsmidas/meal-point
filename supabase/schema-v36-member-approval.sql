-- =========================================================
-- v36: 회원 승인 단계 + 사업자등록증 (2026-10-04)
--
-- 흐름: 홈페이지 회원가입(업체명·사업자번호·사업자등록증) → approval_status='pending'
--       → 관리자가 거래처에 연결하며 승인(role='company', company_id 지정, approval_status='approved')
--       → 승인된 업체는 상품마다 자기 단가(company_prices)를 본다.
-- 사업자등록증은 비공개 버킷 biz-certs 에 저장하고 관리자만 서명 URL 로 본다.
-- =========================================================

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'none'; -- none | pending | approved | rejected
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS biz_number TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS biz_cert_path TEXT;            -- biz-certs 버킷 내 경로
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS reject_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_members_approval_status ON public.members(approval_status);

-- 이미 거래처에 연결된 발주 계정은 승인 완료로 간주
UPDATE public.members SET approval_status = 'approved', approved_at = COALESCE(approved_at, updated_at)
WHERE role = 'company' AND company_id IS NOT NULL AND approval_status = 'none';

-- 사업자등록증 비공개 버킷 (정책 없음 → service_role 만 접근)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('biz-certs', 'biz-certs', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;
