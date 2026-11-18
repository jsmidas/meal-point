/**
 * 판매 단가 결정 — 개당 단가와 박스 금액을 함께 구한다 (schema-v44).
 *
 * 우선순위는 예전과 같다: 거래처별 단가 > 상품 기본 판매가.
 *  - 개당 단가(ea): 낱개 판매에 쓴다.
 *  - 박스 금액(box): 박스 단위 판매·명세서·주문·견적에 쓴다.
 *    단가표에 박스 금액이 따로 저장돼 있으면 그 금액, 없으면 개당 단가 × 입수.
 *
 * 거래처별 단가가 있는 상품은 박스 금액도 거래처 쪽 값만 본다.
 * (거래처 개당 단가 + 상품 기본 박스 금액처럼 서로 다른 출처가 섞이지 않게 한다)
 */

export interface SellPriceProduct {
  selling_price?: number | string | null;
  selling_box_price?: number | string | null;
  box_quantity?: number | null;
}

export interface SellPriceOverride {
  custom_price: number | string;
  box_price?: number | string | null;
}

export interface SellPrice {
  /** 개당 단가 */
  ea: number;
  /** 박스 금액 (박스 상품이 아니면 개당 단가와 같다) */
  box: number;
  /** 박스 입수 (박스 상품이 아니면 1) */
  boxQty: number;
}

const positive = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function resolveSellPrice(
  product: SellPriceProduct | null | undefined,
  override?: SellPriceOverride | null,
): SellPrice {
  const rawBoxQty = Number(product?.box_quantity) || 1;
  const boxQty = rawBoxQty > 1 ? rawBoxQty : 1;

  const ea = override ? Number(override.custom_price) || 0 : Number(product?.selling_price) || 0;
  const storedBox = override ? positive(override.box_price) : positive(product?.selling_box_price);

  return { ea, box: boxQty > 1 ? storedBox || ea * boxQty : ea, boxQty };
}
