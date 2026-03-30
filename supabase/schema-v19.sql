-- 상세페이지: 섹션 순서 저장
ALTER TABLE product_pages ADD COLUMN IF NOT EXISTS section_order TEXT[] DEFAULT '{hero,feature,keypoints,specs,detail,process,gallery,figma}';
