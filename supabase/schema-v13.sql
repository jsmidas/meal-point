-- v13: 견적서 수신자 직접입력 지원 + 발송 이력 테이블

-- 1) quotes 테이블: company_id를 nullable로 변경하고 수신자 직접입력 필드 추가
ALTER TABLE quotes ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_name TEXT DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_ceo_name TEXT DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_biz_number TEXT DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_biz_type TEXT DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_biz_category TEXT DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_address TEXT DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recipient_phone TEXT DEFAULT NULL;

-- 2) 견적서 발송 이력 테이블
CREATE TABLE IF NOT EXISTS quote_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_method TEXT NOT NULL DEFAULT 'manual',  -- manual, email, print, pdf 등
  recipient_info TEXT,                          -- 발송 대상 정보 (이메일, 이름 등)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE quote_send_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for quote_send_logs" ON quote_send_logs FOR ALL USING (true) WITH CHECK (true);

-- 3) 거래명세서 발송 이력 테이블
CREATE TABLE IF NOT EXISTS statement_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_method TEXT NOT NULL DEFAULT 'manual',  -- manual, email, print, pdf 등
  recipient_info TEXT,                          -- 발송 대상 정보 (이메일, 이름 등)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE statement_send_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for statement_send_logs" ON statement_send_logs FOR ALL USING (true) WITH CHECK (true);
