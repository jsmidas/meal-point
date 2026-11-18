/**
 * 재고 목록 행(inventory) 보장.
 *
 * 재고 수량은 수불 로그(inventory_logs)를 누적해서 구한다(재고 화면의 기초·입고·출고·기말).
 * inventory 표는 "재고 목록에 보일 상품"과 안전재고만 가진다.
 *
 * 예전에는 판매·입고·조정 때마다 inventory.current_stock 도 따로 더하고 빼서 맞췄는데,
 *  - 읽고 → 계산하고 → 쓰는 사이에 다른 기록이 끼면 값이 틀어지고,
 *  - 0 밑으로 내려가지 않게 막은 탓에 삭제·수정을 거치면 로그 누적값과 달라졌다.
 * 화면 어디에서도 이 컬럼을 읽지 않으므로 더 이상 갱신하지 않는다.
 * (current_stock, last_in_date, last_out_date 컬럼은 DB에 남아 있지만 쓰지 않는다)
 */
import { dbInsert } from "./db";

/** 이 상품의 inventory 행이 없으면 만든다. 이미 있으면 아무것도 하지 않는다. */
export async function ensureInventoryRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  productId: string | null | undefined,
): Promise<void> {
  if (!productId) return;
  const { data, error } = await db.from("inventory").select("id").eq("product_id", productId).maybeSingle();
  // 조회가 실패했으면 만들지 않는다(이미 있는 행을 중복으로 넣지 않기 위해)
  if (error || data) return;
  await dbInsert("inventory", { product_id: productId });
}
