-- v9: 회원(members) 테이블 (소셜 로그인 지원)
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  login_id TEXT UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  provider TEXT DEFAULT 'local',
  provider_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- provider + provider_id 복합 유니크 (소셜 로그인 중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_provider ON members(provider, provider_id) WHERE provider != 'local';

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_members_updated_at();
