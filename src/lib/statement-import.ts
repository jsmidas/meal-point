/**
 * 판매(출고) 기록 → 거래명세서 항목 변환.
 *
 * 원칙: 명세서 항목의 금액 합은 판매 기록의 금액 합(수량 × 개당 단가)과 정확히 같아야 한다.
 * 정산 화면이 판매액과 명세서 금액을 대조하므로, 불러오는 과정에서 금액이 달라지면 안 된다.
 *
 *  - 같은 상품이라도 단가가 다르면 줄을 나눈다. (예전에는 첫 기록의 단가로 전부 다시 계산해,
 *    기간 중 단가가 바뀌면 금액이 틀어졌다)
 *  - 박스 환산은 수량을 모두 더한 뒤에 한다. (예전에는 기록마다 반올림해, 150개씩 두 번 출고하면
 *    1박스가 아니라 2박스가 됐다)
 *  - 더한 수량이 박스 입수로 나누어떨어지지 않으면 박스로 바꾸지 않고 낱개로 적는다.
 *    반올림해 박스로 적으면 수량과 금액이 실제와 달라지기 때문이다.
 */

export interface SalesLogForImport {
  product_id?: string | null;
  quantity: number; // 낱개(EA) 수량
  unit_price?: number | null; // 개당 단가
  reason?: string | null;
  products?: { name?: string | null; unit?: string | null; box_quantity?: number | null } | null;
}

export interface ImportedStatementItem {
  product_id: string | null;
  product_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export function salesLogsToStatementItems(logs: SalesLogForImport[]): ImportedStatementItem[] {
  // 상품 + 개당 단가별로 낱개 수량을 모은다 (처음 나온 순서 유지)
  const groups = new Map<
    string,
    { productId: string | null; name: string; unit: string; boxQty: number; eaPrice: number; totalEa: number }
  >();

  for (const log of logs) {
    const eaPrice = Number(log.unit_price) || 0;
    const qty = Number(log.quantity) || 0;
    if (qty === 0) continue;
    const productKey = log.product_id || `manual_${log.reason || "기타"}`;
    const key = `${productKey}@${eaPrice}`;
    const g = groups.get(key);
    if (g) {
      g.totalEa += qty;
    } else {
      const boxQty = Number(log.products?.box_quantity) || 1;
      groups.set(key, {
        productId: log.product_id || null,
        name: log.products?.name || log.reason || "기타",
        unit: log.products?.unit || (log.product_id ? "EA" : "식"),
        boxQty: boxQty > 1 ? boxQty : 1,
        eaPrice,
        totalEa: qty,
      });
    }
  }

  const items: ImportedStatementItem[] = [];
  for (const g of groups.values()) {
    const amount = g.totalEa * g.eaPrice; // 판매 기록의 금액 그대로
    const wholeBoxes = g.boxQty > 1 && g.totalEa % g.boxQty === 0;

    if (wholeBoxes) {
      items.push({
        product_id: g.productId,
        product_name: g.name,
        specification: `1박스/${g.boxQty}${g.unit}`,
        unit: "박스",
        quantity: g.totalEa / g.boxQty,
        unit_price: g.eaPrice * g.boxQty,
        amount,
      });
    } else {
      items.push({
        product_id: g.productId,
        product_name: g.name,
        // 박스 상품인데 낱개로 적은 경우, 몇 박스 몇 개인지 규격란에 남긴다
        specification:
          g.boxQty > 1
            ? `낱개 (${Math.floor(g.totalEa / g.boxQty)}박스+${g.totalEa % g.boxQty}${g.unit}, 1박스/${g.boxQty}${g.unit})`
            : "",
        unit: g.unit,
        quantity: g.totalEa,
        unit_price: g.eaPrice,
        amount,
      });
    }
  }
  return items;
}
