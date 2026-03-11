-- ============================================
-- 5단계: 상품 상세페이지
-- ============================================

-- 상품 상세페이지 테이블 (1 product : 1 page)
CREATE TABLE IF NOT EXISTS product_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- 히어로 섹션
  hero_image TEXT,
  subtitle TEXT,
  -- 특장점 섹션
  feature_title TEXT,
  feature_description TEXT,
  feature_image TEXT,
  -- 4가지 키포인트 (JSON array: [{icon, title, description}])
  key_points JSONB DEFAULT '[]'::jsonb,
  -- 스펙 테이블 (JSON array: [{label, value}])
  specs JSONB DEFAULT '[]'::jsonb,
  -- 상세 설명
  detail_description TEXT,
  detail_images JSONB DEFAULT '[]'::jsonb,
  -- 공정/선택 섹션
  process_title TEXT,
  process_steps JSONB DEFAULT '[]'::jsonb,
  -- 갤러리 이미지 (JSON array of URLs)
  gallery_images JSONB DEFAULT '[]'::jsonb,
  -- Figma 디자인 임베드
  figma_urls JSONB DEFAULT '[]'::jsonb,
  -- 공개 여부
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id)
);

CREATE TRIGGER set_product_pages_updated_at
  BEFORE UPDATE ON product_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_product_pages_product ON product_pages(product_id);
CREATE INDEX idx_product_pages_published ON product_pages(is_published);
