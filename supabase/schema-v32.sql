-- v32: 식단·급식관리 프로그램 게스트 체험
-- 외부 식단관리 솔루션의 게스트 계정 풀을 두고, 카카오 인증한 회원에게
-- 1주일 사용권을 발급(계정 1개 자동 점유)한 뒤 만료 시 자동 회수한다.
-- 보안: 게스트 계정 PW가 담기므로 RLS를 켜고 정책을 두지 않아
--       service_role(createAdminClient)로만 접근 가능하게 한다. anon 직접 조회 차단.

-- 외부 식단관리 프로그램의 게스트 로그인 계정 풀
CREATE TABLE IF NOT EXISTS meal_guest_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  login_id TEXT NOT NULL,                       -- 외부 프로그램 게스트 아이디
  login_pw TEXT NOT NULL,                        -- 표시용(외부 계정이므로 평문 보관)
  label TEXT,                                    -- 관리용 메모 (예: "체험계정 1")
  status TEXT NOT NULL DEFAULT 'available',      -- available | assigned
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 체험 사용권 (members 1명 = grant 이력)
CREATE TABLE IF NOT EXISTS meal_trial_grants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  guest_account_id UUID REFERENCES meal_guest_accounts(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',          -- active | expired | revoked
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trial_grants_member ON meal_trial_grants(member_id);
CREATE INDEX IF NOT EXISTS idx_trial_grants_status ON meal_trial_grants(status, expires_at);

ALTER TABLE meal_guest_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_trial_grants ENABLE ROW LEVEL SECURITY;

-- 동시 발급 경합을 막는 원자적 계정 점유.
-- 비어있는(available) 계정 1개를 잠그고 assigned로 바꿔 반환한다.
-- 동시에 호출돼도 FOR UPDATE SKIP LOCKED로 서로 다른 계정을 잡는다.
CREATE OR REPLACE FUNCTION claim_guest_account()
RETURNS SETOF meal_guest_accounts AS $$
  UPDATE meal_guest_accounts
  SET status = 'assigned'
  WHERE id = (
    SELECT id FROM meal_guest_accounts
    WHERE status = 'available' AND is_active = true
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;
