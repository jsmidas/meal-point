/**
 * 매출 인정 기준 — 정산·손익·대시보드가 모두 이 규칙 하나를 쓴다.
 *
 * 판매 관리 달력에서 "날짜 + 거래처" 단위로 체크(승인)한 판매만 매출로 인정한다.
 *  - 체크는 sale_checks 테이블(sale_date, company_id)에 저장된다.
 *  - 같은 거래처라도 체크하지 않은 날짜의 판매는 매출에 넣지 않는다.
 *  - 자가소비(type='self')는 승인 개념이 없다. 매출에 넣을지는 화면이 정한다(손익은 별도 행으로 포함).
 *
 * 예전에는 화면마다 기준이 달랐다(정산: 그 달에 하루라도 체크한 거래처의 판매 전부,
 * 손익: 체크한 날짜만, 대시보드: 체크와 무관하게 전부). 같은 달 매출이 화면마다 달라지는 원인이었다.
 */

export interface SaleCheckRow {
  sale_date: string; // YYYY-MM-DD
  company_id: string | null;
}

const key = (date: string, companyId: string) => `${date}_${companyId}`;

/** 체크(승인) 목록을 조회용 집합으로 만든다. */
export function buildConfirmedSales(checks: SaleCheckRow[] | null | undefined): Set<string> {
  const set = new Set<string>();
  for (const c of checks || []) {
    if (c.company_id && c.sale_date) set.add(key(c.sale_date, c.company_id));
  }
  return set;
}

/** 이 판매(출고) 기록이 매출로 인정되는가 — 판매일과 거래처가 체크돼 있어야 한다. */
export function isConfirmedSale(
  log: { log_date?: string | null; company_id?: string | null },
  confirmed: Set<string>,
): boolean {
  if (!log.log_date || !log.company_id) return false;
  return confirmed.has(key(log.log_date, log.company_id));
}
