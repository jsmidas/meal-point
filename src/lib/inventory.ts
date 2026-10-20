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
