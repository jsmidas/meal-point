-- 이관 후 DB에 저장된 Storage URL 의 프로젝트 호스트 교체
-- 신 프로젝트 SQL Editor 에서 실행. OLD_REF / NEW_REF 를 실제 값으로 바꿀 것.
--   OLD: lrctaritoeqgliaewpfe   NEW: (신 프로젝트 ref)
DO $$
DECLARE
  old_host TEXT := 'https://lrctaritoeqgliaewpfe.supabase.co';
  new_host TEXT := 'https://NEW_REF.supabase.co';
BEGIN
  UPDATE company_info SET
    logo_image_url  = replace(coalesce(logo_image_url, ''),  old_host, new_host),
    stamp_image_url = replace(coalesce(stamp_image_url, ''), old_host, new_host);
  UPDATE products  SET image_url = replace(image_url, old_host, new_host) WHERE image_url LIKE old_host || '%';
  UPDATE companies SET biz_cert_image_url = replace(biz_cert_image_url, old_host, new_host) WHERE biz_cert_image_url LIKE old_host || '%';
  UPDATE popups    SET image_url = replace(image_url, old_host, new_host) WHERE image_url LIKE old_host || '%';
  UPDATE product_pages SET
    hero_image     = replace(hero_image, old_host, new_host),
    feature_image  = replace(feature_image, old_host, new_host),
    hero_images    = coalesce((SELECT array_agg(replace(x, old_host, new_host)) FROM unnest(hero_images) x), '{}'),
    feature_images = coalesce((SELECT array_agg(replace(x, old_host, new_host)) FROM unnest(feature_images) x), '{}'),
    detail_images  = coalesce((SELECT array_agg(replace(x, old_host, new_host)) FROM unnest(detail_images) x), '{}'),
    gallery_images = coalesce((SELECT array_agg(replace(x, old_host, new_host)) FROM unnest(gallery_images) x), '{}');
END $$;

-- 검증: 옛 호스트가 남아 있으면 0 이 아니어야 함
SELECT 'company_info' t, count(*) FROM company_info WHERE logo_image_url LIKE '%lrctaritoeqgliaewpfe%' OR stamp_image_url LIKE '%lrctaritoeqgliaewpfe%'
UNION ALL SELECT 'products', count(*) FROM products WHERE image_url LIKE '%lrctaritoeqgliaewpfe%'
UNION ALL SELECT 'companies', count(*) FROM companies WHERE biz_cert_image_url LIKE '%lrctaritoeqgliaewpfe%'
UNION ALL SELECT 'popups', count(*) FROM popups WHERE image_url LIKE '%lrctaritoeqgliaewpfe%'
UNION ALL SELECT 'product_pages', count(*) FROM product_pages WHERE array_to_string(hero_images || feature_images || detail_images || gallery_images, ',') LIKE '%lrctaritoeqgliaewpfe%';
