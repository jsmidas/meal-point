import { getLiveSession } from "./guard";

export interface PortalSession {
  memberId: string;
  companyId: string;
  name: string | null;
}

/**
 * 포털(거래처 발주 계정) 세션을 서명된 쿠키에서 읽는다.
 * role='company' 이고 company_id 가 있을 때만 유효.
 * 계정 정지·승인 취소·거래처 변경이 바로 반영되도록 DB의 현재 상태와 대조한다.
 * 서버(API Route / Server Component)에서만 호출할 것.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  const s = await getLiveSession();
  if (!s || s.role !== "company" || !s.company_id || !s.id) return null;
  return { memberId: s.id, companyId: s.company_id, name: s.name || null };
}
