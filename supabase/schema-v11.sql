-- v11: 상품에 박스당 수량(box_quantity) 컬럼 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_quantity integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN products.box_quantity IS '박스당 수량 (예: 내피 300장 = 1박스)';
