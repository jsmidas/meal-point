-- v15: inventory_logs.product_id를 nullable로 변경 (수작업 항목: 배송비, 금형비 등)
ALTER TABLE inventory_logs ALTER COLUMN product_id DROP NOT NULL;
