import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * service_role 키를 사용하는 서버 전용 Supabase 클라이언트.
 * RLS를 우회하므로 반드시 서버(API Route)에서만 사용할 것.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다. " +
        "Supabase 대시보드 > Settings > API에서 service_role key를 복사하여 .env.local에 추가하세요.",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
