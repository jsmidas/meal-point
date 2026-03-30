-- 상세페이지: 히어로/특장점 복수 이미지 지원
ALTER TABLE product_pages ADD COLUMN IF NOT EXISTS hero_images TEXT[] DEFAULT '{}';
ALTER TABLE product_pages ADD COLUMN IF NOT EXISTS feature_images TEXT[] DEFAULT '{}';

-- 기존 단일 이미지 → 배열로 마이그레이션
UPDATE product_pages SET hero_images = ARRAY[hero_image] WHERE hero_image IS NOT NULL AND hero_images = '{}';
UPDATE product_pages SET feature_images = ARRAY[feature_image] WHERE feature_image IS NOT NULL AND feature_images = '{}';
