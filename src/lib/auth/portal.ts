import { cookies } from "next/headers";

const COOKIE_NAME = "mp_admin_token";

export interface PortalSession {
  memberId: string;
  companyId: string;
  name: string | null;
}

/**
 * 포털(거래처 발주 계정) 세션을 쿠키에서 읽는다.
 * role='company' 이고 company_id 가 있을 때만 유효.
 * 서버(API Route / Server Component)에서만 호출할 것.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed.role !== "company" || !parsed.company_id || !parsed.id) {
      return null;
    }
    return {
      memberId: parsed.id,
      companyId: parsed.company_id,
      name: parsed.name || null,
    };
  } catch {
    return null;
  }
}
