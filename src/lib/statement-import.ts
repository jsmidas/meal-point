/**
 * 판매(출고) 기록 → 거래명세서 항목 변환.
 *
 * 원칙: 명세서 항목의 금액 합은 판매 기록의 금액 합(logAmount)과 정확히 같아야 한다.
 * 정산 화면이 판매액과 명세서 금액을 대조하므로, 불러오는 과정에서 금액이 달라지면 안 된다.
 *
 *  - 같은 상품이라도 단가가 다르면 줄을 나눈다. (예전에는 첫 기록의 단가로 전부 다시 계산해,
 *    기간 중 단가가 바뀌면 금액이 틀어졌다)
 *  - 박스 환산은 수량을 모두 더한 뒤에 한다. (예전에는 기록마다 반올림해, 150개씩 두 번 출고하면
 *    1박스가 아니라 2박스가 됐다)
 *  - 더한 수량이 박스 입수로 나누어떨어지지 않으면 박스로 바꾸지 않고 낱개로 적는다.
 *    반올림해 박스로 적으면 수량과 금액이 실제와 달라지기 때문이다.
 *  - 금액이 따로 기록된 판매(amount, schema-v43)는 박스 단가별로 줄을 나눠 그 박스 단가 그대로 적는다.
 *    (박스 50,000원 / 300개 → 개당 167원이 아니라 박스 50,000원)
 */

import { logAmount, logBoxPrice } from "./inventory";

export interface SalesLogForImport {
  product_id?: string | null;
  quantity: number; // 낱개(EA) 수량
  unit_price?: number | null; // 개당 단가
  amount?: number | null; // 판매 금액 (없으면 수량 × 개당 단가)
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

type Group = {
  productId: string | null;
  name: string;
  unit: string;
  boxQty: number;
  eaPrice: number;
  /** 금액이 따로 기록된 판매의 박스 단가 (없으면 개당 단가 × 입수) */
  boxPrice: number | null;
  /** 금액은 따로 기록됐지만 박스 단가로 나타낼 수 없는 판매 — 금액을 그대로 한 줄로 적는다 */
  lumpSum: boolean;
  totalEa: number;
  amount: number;
};

export function salesLogsToStatementItems(logs: SalesLogForImport[]): ImportedStatementItem[] {
  // 상품 + 단가별로 낱개 수량과 금액을 모은다 (처음 나온 순서 유지)
  const groups = new Map<string, Group>();

  logs.forEach((log, index) => {
    const eaPrice = Number(log.unit_price) || 0;
    const qty = Number(log.quantity) || 0;
    if (qty === 0) return;
    const rawBoxQty = Number(log.products?.box_quantity) || 1;
    const boxQty = rawBoxQty > 1 ? rawBoxQty : 1;
    const amount = logAmount(log);

    // 금액이 수량 × 개당 단가와 다른 판매만 따로 다룬다
    const exact = amount !== qty * eaPrice;
    const boxPrice = exact ? logBoxPrice(log, boxQty) : null;
    const lumpSum = exact && boxPrice === null;

    const productKey = log.product_id || `manual_${log.reason || "기타"}`;
    const priceKey = lumpSum ? `lump${index}` : boxPrice !== null ? `box${boxPrice}` : `ea${eaPrice}`;
    const key = `${productKey}@${priceKey}`;
    const g = groups.get(key);
    if (g) {
      g.totalEa += qty;
      g.amount += amount;
    } else {
      groups.set(key, {
        productId: log.product_id || null,
        name: log.products?.name || log.reason || "기타",
        unit: log.products?.unit || (log.product_id ? "EA" : "식"),
        boxQty,
        eaPrice,
        boxPrice,
        lumpSum,
        totalEa: qty,
        amount,
      });
    }
  });

  const items: ImportedStatementItem[] = [];
  for (const g of groups.values()) {
    if (g.lumpSum) {
      // 수량 × 단가로 나타낼 수 없는 금액 (판매 뒤 상품의 박스 입수가 바뀐 경우 등) → 1식으로 금액 그대로
      items.push({
        product_id: g.productId,
        product_name: g.name,
        specification: `${g.totalEa}${g.unit}`,
        unit: "식",
        quantity: 1,
        unit_price: g.amount,
        amount: g.amount,
      });
      continue;
    }

    // 박스 단가로 모은 줄은 모든 기록이 박스 단위이므로 항상 나누어떨어진다
    const wholeBoxes = g.boxQty > 1 && g.totalEa % g.boxQty === 0;

    if (wholeBoxes) {
      items.push({
        product_id: g.productId,
        product_name: g.name,
        specification: `1박스/${g.boxQty}${g.unit}`,
        unit: "박스",
        quantity: g.totalEa / g.boxQty,
        unit_price: g.boxPrice ?? g.eaPrice * g.boxQty,
        amount: g.amount, // 판매 기록의 금액 그대로
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
        amount: g.amount,
      });
    }
  }
  return items;
}
