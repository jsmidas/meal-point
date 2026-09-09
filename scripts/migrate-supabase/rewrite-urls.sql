-- 이관 후 DB에 저장된 Storage URL 의 프로젝트 호스트 교체
-- 신 프로젝트에서 실행. NEW_REF 를 실제 값으로 치환할 것 (cutover.sh 가 sed 로 치환).
--   OLD: lrctaritoeqgliaewpfe   NEW: NEW_REF
-- 컬럼 타입: hero_image/feature_image text, hero_images/feature_images text[], detail_images/gallery_images jsonb
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
    hero_images    = replace(hero_images::text, old_host, new_host)::text[],
    feature_images = replace(feature_images::text, old_host, new_host)::text[],
    detail_images  = replace(detail_images::text, old_host, new_host)::jsonb,
    gallery_images = replace(gallery_images::text, old_host, new_host)::jsonb;
END $$;

-- 검증: 옛 호스트가 남아 있으면 count 가 0 이 아님
SELECT 'company_info' AS t, count(*) FROM company_info WHERE logo_image_url LIKE '%lrctaritoeqgliaewpfe%' OR stamp_image_url LIKE '%lrctaritoeqgliaewpfe%'
UNION ALL SELECT 'products', count(*) FROM products WHERE image_url LIKE '%lrctaritoeqgliaewpfe%'
UNION ALL SELECT 'companies', count(*) FROM companies WHERE biz_cert_image_url LIKE '%lrctaritoeqgliaewpfe%'
UNION ALL SELECT 'popups', count(*) FROM popups WHERE image_url LIKE '%lrctaritoeqgliaewpfe%'
UNION ALL SELECT 'product_pages', count(*) FROM product_pages
  WHERE coalesce(hero_image,'') || coalesce(feature_image,'') || hero_images::text || feature_images::text || detail_images::text || gallery_images::text LIKE '%lrctaritoeqgliaewpfe%'
UNION ALL SELECT 'product_pages_new_host', count(*) FROM product_pages WHERE hero_images::text LIKE '%NEW_REF%';
