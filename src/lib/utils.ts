/** 한국시간(Asia/Seoul) 기준 오늘 날짜 YYYY-MM-DD. 서버(UTC)·브라우저 어디서 불러도 같은 값을 낸다. */
export function todayKST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 한국시간 기준 이번 달 YYYY-MM */
export function currentMonthKST(d: Date = new Date()): string {
  return todayKST(d).slice(0, 7);
}

/** 문서번호용 날짜 YYYYMMDD (한국시간) */
function numberDate(): string {
  return todayKST().replace(/-/g, "");
}

function rand3(): string {
  return String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
}

/** 주문번호 생성: ORD-20260312-001 */
export function generateOrderNumber() {
  return `ORD-${numberDate()}-${rand3()}`;
}

/** 거래명세서번호 생성: ST-20260312-001 */
export function generateStatementNumber() {
  return `ST-${numberDate()}-${rand3()}`;
}

/** 주문 상태 한글 라벨 */
export const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-yellow-400/10 text-yellow-400" },
  confirmed: { label: "확인", color: "bg-blue-400/10 text-blue-400" },
  shipped: { label: "배송중", color: "bg-accent/10 text-accent" },
  delivered: { label: "배송완료", color: "bg-emerald-400/10 text-emerald-400" },
  cancelled: { label: "취소", color: "bg-red-400/10 text-red-400" },
};

/** 견적서번호 생성: QT-20260312-001 */
export function generateQuoteNumber() {
  return `QT-${numberDate()}-${rand3()}`;
}

/** 청구번호 생성: BL-202603-001 (난수라 겹칠 수 있다 — 저장 실패 시 호출부에서 새 번호로 재시도할 것) */
export function generateBillingNumber(month: string) {
  return `BL-${month.replace("-", "")}-${rand3()}`;
}

/** 견적서 상태 */
export const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "작성중", color: "bg-gray-400/10 text-gray-400" },
  sent: { label: "발송", color: "bg-blue-400/10 text-blue-400" },
  accepted: { label: "수락", color: "bg-emerald-400/10 text-emerald-400" },
  rejected: { label: "거절", color: "bg-red-400/10 text-red-400" },
  expired: { label: "만료", color: "bg-yellow-400/10 text-yellow-400" },
};

/** 청구 상태 */
export const BILLING_STATUS: Record<string, { label: string; color: string }> = {
  unpaid: { label: "미수", color: "bg-red-400/10 text-red-400" },
  partial: { label: "부분입금", color: "bg-yellow-400/10 text-yellow-400" },
  paid: { label: "완납", color: "bg-emerald-400/10 text-emerald-400" },
};

/** 판관비 카테고리 — 앞 4개는 손익 현황 표에 항상 행으로 표시 */
export const EXPENSE_CATEGORIES = [
  "광고비",
  "포장박스",
  "포장비닐",
  "기타",
  "물류/배송",
  "인건비",
  "임대료",
  "공과금",
  "소모품",
];
/** 손익 현황 표에 항상 보이는 판관비 행 */
export const EXPENSE_FIXED_CATEGORIES = ["광고비", "포장박스", "포장비닐", "기타"];

/** 입출고 타입 */
export const INVENTORY_LOG_TYPES: Record<string, { label: string; color: string }> = {
  in: { label: "입고", color: "text-emerald-400" },
  out: { label: "출고", color: "text-red-400" },
  adjust: { label: "조정", color: "text-yellow-400" },
};

/** 숫자 포맷 (천 단위 콤마) */
export function formatNumber(n: number) {
  return n.toLocaleString("ko-KR");
}

/** 숫자를 한글 금액으로 변환 (예: 3000000 → "삼백만원") */
export function numberToKorean(n: number): string {
  if (n === 0) return "영원";
  const units = ["", "만", "억", "조"];
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const smallUnits = ["", "십", "백", "천"];

  let result = "";
  let unitIdx = 0;
  let num = Math.abs(Math.floor(n));

  while (num > 0) {
    const chunk = num % 10000;
    if (chunk > 0) {
      let chunkStr = "";
      let c = chunk;
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10;
        if (d > 0) {
          const digitStr = (d === 1 && i > 0) ? "" : digits[d];
          chunkStr = digitStr + smallUnits[i] + chunkStr;
        }
        c = Math.floor(c / 10);
      }
      result = chunkStr + units[unitIdx] + result;
    }
    num = Math.floor(num / 10000);
    unitIdx++;
  }

  return (n < 0 ? "마이너스 " : "") + result + "원";
}

/** 날짜 포맷 (YYYY-MM-DD) */
export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
