/**
 * 포털 발주 요청 본문을 검증하고, 서버가 확정한 단가로 발주 항목을 구성한다.
 * 발주 생성(POST)과 수정(PUT)이 같은 규칙을 쓰도록 한곳에 둔다.
 *
 * - 수량: 1 이상 1,000,000 이하의 정수만 허용 (0·빈 값은 "선택 안 함"으로 보고 제외)
 * - 발주일: YYYY-MM-DD 형식의 실제 날짜만 허용, 없으면 한국시간 오늘
 * - 단가: 거래처 단가 > 기본 판매가 순서로 DB에서 확정 (포털 상품 목록과 같은 규칙)
 */
import { todayKST } from "./utils";

export const MAX_ORDER_QUANTITY = 1_000_000;

export interface PortalOrderItem {
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export type PortalOrderResult =
  | { ok: true; items: PortalOrderItem[]; totalAmount: number; notes: string | null; orderDate: string }
  | { ok: false; status: number; error: string };

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export async function buildPortalOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  companyId: string,
  body: unknown,
): Promise<PortalOrderResult> {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "잘못된 요청입니다." };
  }
  const b = body as { items?: unknown; notes?: unknown; order_date?: unknown };

  const rawItems: { product_id?: unknown; quantity?: unknown }[] = Array.isArray(b.items) ? b.items : [];
  const notes: string | null = b.notes ? String(b.notes).slice(0, 2000) : null;

  let orderDate = todayKST();
  if (typeof b.order_date === "string" && b.order_date) {
    if (!isValidDate(b.order_date)) {
      return { ok: false, status: 400, error: "발주일 형식이 올바르지 않습니다." };
    }
    orderDate = b.order_date;
  }

  const wanted: { product_id: string; quantity: number }[] = [];
  for (const raw of rawItems) {
    const productId = String(raw?.product_id || "");
    const quantity = Number(raw?.quantity);
    if (!productId || !quantity) continue; // 0·빈 값은 선택하지 않은 줄
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
      return {
        ok: false,
        status: 400,
        error: `수량은 1 이상 ${MAX_ORDER_QUANTITY.toLocaleString("ko-KR")} 이하의 정수로 입력하세요.`,
      };
    }
    wanted.push({ product_id: productId, quantity });
  }
  if (wanted.length === 0) {
    return { ok: false, status: 400, error: "발주할 상품과 수량을 입력하세요." };
  }

  // 단가는 서버가 DB에서 확정 (거래처 단가 > 기본 판매가)
  const productIds = [...new Set(wanted.map((i) => i.product_id))];
  const [productsRes, pricesRes] = await Promise.all([
    db.from("products").select("id, name, unit, selling_price, is_active").in("id", productIds),
    db.from("company_prices").select("product_id, custom_price").eq("company_id", companyId).in("product_id", productIds),
  ]);
  // 조회가 실패했는데 그대로 진행하면 거래처 단가 대신 기본 판매가로 발주가 만들어진다 → 중단
  if (productsRes.error || pricesRes.error) {
    console.error("[portal-order] 상품·단가 조회 실패", productsRes.error?.message || pricesRes.error?.message);
    return { ok: false, status: 500, error: "상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  const productMap = new Map<string, { name: string; unit: string; selling_price: number; is_active: boolean }>();
  for (const p of productsRes.data || []) productMap.set(p.id, p);
  const priceMap: Record<string, number> = {};
  for (const row of pricesRes.data || []) priceMap[row.product_id] = Number(row.custom_price);

  const items: PortalOrderItem[] = [];
  for (const w of wanted) {
    const p = productMap.get(w.product_id);
    if (!p || !p.is_active) {
      return { ok: false, status: 400, error: "판매 중이 아닌 상품이 포함되어 있습니다." };
    }
    const rawPrice = Number(priceMap[w.product_id] ?? p.selling_price ?? 0);
    // 금액 컬럼은 정수(원)다. 소수 단가가 등록돼 있어도 저장이 실패하지 않도록 원 단위로 맞춘다.
    const unitPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? Math.round(rawPrice) : 0;
    items.push({
      product_id: w.product_id,
      product_name: p.name,
      unit: p.unit,
      quantity: w.quantity,
      unit_price: unitPrice,
      amount: unitPrice * w.quantity,
    });
  }

  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  return { ok: true, items, totalAmount, notes, orderDate };
}
