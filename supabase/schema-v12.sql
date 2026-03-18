-- v12: 회사 정보에 로고 이미지 URL 컬럼 추가
ALTER TABLE company_info ADD COLUMN IF NOT EXISTS logo_image_url TEXT DEFAULT NULL;

COMMENT ON COLUMN company_info.logo_image_url IS '회사 로고 이미지 URL (견적서, 거래명세서, 홈페이지에 사용)';

-- Supabase Storage 버킷 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;

-- 로고 버킷 공개 읽기 정책
CREATE POLICY "Public read logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Auth upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Auth update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos');
CREATE POLICY "Auth delete logos" ON storage.objects FOR DELETE USING (bucket_id = 'logos');
