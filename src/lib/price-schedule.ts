/**
 * 거래처별 판매 단가의 "적용일" 처리 (서버 전용).
 *
 * 구조
 *  - company_price_history : 단가 변경 이력. 적용 시작일(effective_from)을 갖는다.
 *  - company_prices        : "지금 적용 중인 단가" 표. 판매·주문·명세서·포털 발주가 모두 이 표를 읽는다.
 *
 * 규칙
 *  - 지금 적용 중인 단가 = 이력 중 적용일이 오늘(한국시간) 이하인 것 가운데 가장 최근 것
 *    (적용일이 같으면 나중에 저장한 것). 가격 0은 "거래처 단가 없음(기본가로 복귀)" 표시다.
 *  - 적용일이 미래인 단가는 이력에만 남고, 그 날짜가 되면 company_prices 에 반영된다.
 *    반영은 매일 자정(한국시간) 예약 작업과, 단가 관리 화면을 열 때 수행한다.
 *
 * 예전 방식과의 호환
 *  - 이 기능 이전에는 미래 적용일로 저장해도 즉시 적용됐다. 그렇게 이미 적용돼 쓰이고 있는 단가를
 *    뒤늦게 되돌리지 않도록, 기준 시각(SCHEDULE_CUTOFF) 이전에 저장된 이력은 "저장한 날부터 적용"으로 본다.
 */
import { fetchAllRows } from "./fetch-all";
import { todayKST } from "./utils";

/** 이 시각 이후에 저장된 이력부터 적용일 규칙을 엄격히 따른다. */
const SCHEDULE_CUTOFF_MS = Date.parse("2026-11-19T00:00:00+09:00");

export interface SellHistoryRow {
  company_id: string;
  product_id: string;
  price: number | string;
  effective_from: string; // YYYY-MM-DD
  created_at: string; // ISO
}

/** 이 이력이 실제로 효력을 갖기 시작하는 날짜 (YYYY-MM-DD, 한국시간) */
export function effectiveDateOf(h: SellHistoryRow): string {
  const createdMs = Date.parse(h.created_at);
  if (Number.isFinite(createdMs) && createdMs < SCHEDULE_CUTOFF_MS) {
    const createdDay = todayKST(new Date(createdMs));
    if (h.effective_from > createdDay) return createdDay; // 예전에 즉시 적용됐던 미래 적용일 단가
  }
  return h.effective_from;
}

/** 아직 적용일이 오지 않아 대기 중인 이력인가 */
export function isPending(h: SellHistoryRow, today: string): boolean {
  return effectiveDateOf(h) > today;
}

/**
 * 한 거래처·상품의 이력에서 today 기준으로 적용 중인 단가를 구한다.
 * @returns 단가(>0) / null(기본가로 복귀 또는 거래처 단가 없음) / undefined(아직 효력 있는 이력이 없음 — 판단 보류)
 */
export function priceAsOf(rows: SellHistoryRow[], today: string): number | null | undefined {
  let best: SellHistoryRow | null = null;
  let bestDate = "";
  for (const r of rows) {
    const d = effectiveDateOf(r);
    if (d > today) continue;
    if (!best || d > bestDate || (d === bestDate && r.created_at > best.created_at)) {
      best = r;
      bestDate = d;
    }
  }
  if (!best) return undefined;
  const price = Number(best.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export interface SyncResult {
  checked: number; // 살펴본 거래처·상품 조합 수
  changed: number; // 실제로 바뀐 조합 수
  errors: string[];
}

const pairKey = (companyId: string, productId: string) => `${companyId}_${productId}`;

/**
 * company_prices 를 이력 기준의 "지금 적용 중인 단가"로 맞춘다.
 *
 * @param pairs 지정하면 그 조합만 맞춘다(단가 저장 직후). 생략하면 적용일을 기다리던 이력이 있는 조합만
 *              살펴본다(자정 예약 작업·화면 진입 시) — 예약 단가와 무관한 조합은 건드리지 않는다.
 * @param today 기준 날짜(YYYY-MM-DD). 생략하면 한국시간 오늘. 시험용으로만 지정한다.
 */
export async function syncSellPrices(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  pairs?: { companyId: string; productId: string }[],
  today: string = todayKST(),
): Promise<SyncResult> {
  const result: SyncResult = { checked: 0, changed: 0, errors: [] };

  const [histRes, cacheRes] = await Promise.all([
    fetchAllRows<SellHistoryRow>(() =>
      db
        .from("company_price_history")
        .select("id, company_id, product_id, price, effective_from, created_at")
        .eq("price_type", "sell")
        .not("company_id", "is", null)
        .order("id"),
    ),
    fetchAllRows<{ id: string; company_id: string; product_id: string; custom_price: number | string }>(() =>
      db.from("company_prices").select("id, company_id, product_id, custom_price").order("id"),
    ),
  ]);
  if (histRes.error || cacheRes.error) {
    result.errors.push(histRes.error?.message || cacheRes.error?.message || "단가 조회 실패");
    return result;
  }

  const byPair = new Map<string, SellHistoryRow[]>();
  for (const h of histRes.data) {
    const k = pairKey(h.company_id, h.product_id);
    const list = byPair.get(k);
    if (list) list.push(h);
    else byPair.set(k, [h]);
  }
  const cache = new Map<string, { id: string; price: number }>();
  for (const c of cacheRes.data) {
    cache.set(pairKey(c.company_id, c.product_id), { id: c.id, price: Number(c.custom_price) });
  }

  // 대상 조합 고르기
  let targets: string[];
  if (pairs && pairs.length > 0) {
    targets = [...new Set(pairs.map((p) => pairKey(p.companyId, p.productId)))];
  } else {
    // 적용일을 기다렸던(또는 기다리는) 이력이 있는 조합만: 저장한 날보다 적용일이 늦은 이력이 하나라도 있는 경우
    targets = [];
    for (const [k, rows] of byPair) {
      const scheduled = rows.some((r) => {
        const createdMs = Date.parse(r.created_at);
        return Number.isFinite(createdMs) && createdMs >= SCHEDULE_CUTOFF_MS && r.effective_from > todayKST(new Date(createdMs));
      });
      if (scheduled) targets.push(k);
    }
  }

  for (const k of targets) {
    const rows = byPair.get(k);
    if (!rows) continue;
    result.checked++;
    const desired = priceAsOf(rows, today);
    if (desired === undefined) continue; // 아직 효력 있는 이력이 없다 — 현재 값을 그대로 둔다

    const current = cache.get(k);
    const [companyId, productId] = [rows[0].company_id, rows[0].product_id];

    if (desired === null) {
      if (!current) continue;
      const { error } = await db.from("company_prices").delete().eq("id", current.id);
      if (error) result.errors.push(error.message);
      else result.changed++;
    } else if (!current) {
      const { error } = await db
        .from("company_prices")
        .insert({ company_id: companyId, product_id: productId, custom_price: desired });
      if (error) result.errors.push(error.message);
      else result.changed++;
    } else if (current.price !== desired) {
      const { error } = await db.from("company_prices").update({ custom_price: desired }).eq("id", current.id);
      if (error) result.errors.push(error.message);
      else result.changed++;
    }
  }

  return result;
}
