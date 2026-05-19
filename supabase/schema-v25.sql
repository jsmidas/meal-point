-- ============================================
-- v25: 개인결제(비상품 결제) — payment_requests
-- 관리자가 금액·상품명을 입력해 결제 링크를 발급하고,
-- 거래처가 토스페이먼츠 카드결제로 납부하는 구조.
-- 결제 승인/검증은 서버(API)에서만 수행, 카드정보는 저장하지 않음.
-- ============================================

CREATE TABLE payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,                 -- 공개 결제링크용 추측 불가 토큰
  toss_order_id TEXT NOT NULL UNIQUE,         -- 토스 주문번호(멱등성 키)
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL, -- 거래처(선택)
  order_name TEXT NOT NULL,                   -- 결제창에 표시될 상품명
  amount INTEGER NOT NULL CHECK (amount >= 100), -- 결제 금액(원), 토스 최소 100원
  customer_name TEXT,                         -- 주문자명
  customer_phone TEXT,                        -- 주문자 연락처(선택)
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | paid | canceled | expired
  payment_key TEXT,                           -- 토스 결제 식별자(승인 후)
  method TEXT,                                -- 카드/간편결제 등
  receipt_url TEXT,                           -- 토스 영수증 URL
  paid_at TIMESTAMPTZ,                        -- 승인 시각
  expires_at TIMESTAMPTZ NOT NULL,            -- 링크 만료(기본 발급 후 7일)
  billing_id UUID REFERENCES billings(id) ON DELETE SET NULL, -- 정산 연동된 청구
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL, -- 정산 연동된 입금
  memo TEXT,                                  -- 관리자 메모
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_requests_token ON payment_requests(token);
CREATE INDEX idx_payment_requests_status ON payment_requests(status);
CREATE INDEX idx_payment_requests_company ON payment_requests(company_id);
CREATE INDEX idx_payment_requests_created ON payment_requests(created_at DESC);

CREATE TRIGGER set_updated_at_payment_requests
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: anon/authenticated 직접 접근 차단.
-- 모든 읽기/쓰기는 service_role(서버 API)로만 수행한다.
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 검증
-- ============================================
-- SELECT status, COUNT(*) FROM payment_requests GROUP BY status;
-- SELECT token, order_name, amount, status, expires_at FROM payment_requests ORDER BY created_at DESC LIMIT 20;
