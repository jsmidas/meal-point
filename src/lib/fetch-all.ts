/**
 * 행 수 제한 없이 전부 읽기.
 *
 * Supabase(PostgREST)는 한 번에 최대 1,000행까지만 돌려준다. `.limit(5000)` 을 붙여도 1,000행에서 잘리고
 * 오류도 나지 않기 때문에, 데이터가 쌓이면 재고·미수·매출 합계가 조용히 틀려진다.
 * 합계를 내는 조회는 이 함수로 끝까지 읽는다.
 *
 * build 는 호출할 때마다 새 쿼리를 만들어 돌려줘야 하고, 페이지 사이에 순서가 바뀌지 않도록
 * 반드시 고유한 정렬 기준(예: `.order("id")`)으로 끝나야 한다.
 */
const PAGE_SIZE = 1000;
const MAX_ROWS = 200_000; // 폭주 방지용 안전 한도

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: () => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: T[]; error: any }> {
  const all: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: all, error };
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
}

/** 값 목록을 n개씩 나눈다 — `.in()` 에 ID를 수백 개 넣으면 주소 길이 한도를 넘는다. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
