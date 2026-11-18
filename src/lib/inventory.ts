/**
 * 재고 수불 로그(inventory_logs.type) 공용 정의.
 *   in     입고(매입)      재고 +
 *   out    출고(판매)      재고 −  매출·청구·명세서·손익 포함
 *   self   자가소비        재고 −  매출·청구·명세서·손익 제외
 *   adjust 재고 조정(실사) 재고를 quantity 로 맞춤
 */
export type InventoryLogType = "in" | "out" | "self" | "adjust";

export const INVENTORY_LOG_TYPE_LABELS: Record<InventoryLogType, string> = {
  in: "입고(매입)",
  out: "출고(판매)",
  self: "자가소비",
  adjust: "재고 조정",
};

/** 뱃지 색상 (tailwind 클래스) */
export const INVENTORY_LOG_TYPE_BADGE: Record<InventoryLogType, string> = {
  in: "bg-emerald-400/10 text-emerald-400",
  out: "bg-red-400/10 text-red-400",
  self: "bg-violet-400/10 text-violet-400",
  adjust: "bg-sky-400/10 text-sky-400",
};

export function asLogType(type: string): InventoryLogType {
  return type === "in" || type === "out" || type === "self" || type === "adjust" ? type : "out";
}

export function logTypeLabel(type: string): string {
  return INVENTORY_LOG_TYPE_LABELS[asLogType(type)];
}

/**
 * 로그 한 줄의 금액(공급가).
 *
 * unit_price 는 개당 단가(정수)라서, 박스 단가가 입수로 나누어떨어지지 않으면 quantity * unit_price 가
 * 실제 판매 금액과 달라진다(박스 50,000원 / 300개 → 개당 167원 → 50,100원).
 * 그런 판매는 amount 에 금액을 그대로 저장한다(schema-v43). amount 가 없으면 예전 방식으로 계산한다.
 * 판매·정산·손익·대시보드·명세서 불러오기는 금액을 반드시 이 함수로 구한다.
 */
export function logAmount(log: { quantity: number; unit_price?: number | null; amount?: number | null }): number {
  if (log.amount != null) return Number(log.amount) || 0;
  return (Number(log.quantity) || 0) * (Number(log.unit_price) || 0);
}

/**
 * amount 로 기록된 판매의 박스 단가. 박스 단위로 떨어지는 판매가 아니면 null.
 * (amount 가 없는 기록은 개당 단가 × 입수가 박스 단가이므로 null 을 돌려준다)
 */
export function logBoxPrice(
  log: { quantity: number; amount?: number | null },
  boxQuantity: number | null | undefined,
): number | null {
  const boxQty = Number(boxQuantity) || 1;
  const qty = Number(log.quantity) || 0;
  if (log.amount == null || boxQty <= 1 || qty <= 0 || qty % boxQty !== 0) return null;
  const boxes = qty / boxQty;
  const amount = Number(log.amount) || 0;
  return amount % boxes === 0 ? amount / boxes : null;
}

/** 로그 하나를 잔량에 반영. adjust 는 절대값으로 맞춘다. */
export function applyLog(balance: number, type: string, quantity: number): number {
  switch (asLogType(type)) {
    case "in":
      return balance + quantity;
    case "out":
    case "self":
      return balance - quantity;
    case "adjust":
      return quantity;
  }
}
