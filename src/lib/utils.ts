/** 주문번호 생성: ORD-20260312-001 */
export function generateOrderNumber() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `ORD-${date}-${rand}`;
}

/** 거래명세서번호 생성: ST-20260312-001 */
export function generateStatementNumber() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `ST-${date}-${rand}`;
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
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `QT-${date}-${rand}`;
}

/** 청구번호 생성: BL-202603-001 */
export function generateBillingNumber(month: string) {
  const m = month.replace("-", "");
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `BL-${m}-${rand}`;
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

/** 비용 카테고리 */
export const EXPENSE_CATEGORIES = [
  "매입",
  "인건비",
  "물류/배송",
  "임대료",
  "공과금",
  "소모품",
  "마케팅",
  "기타",
];

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
