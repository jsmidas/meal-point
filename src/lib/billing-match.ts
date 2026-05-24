// 판매(출고) ↔ 명세서 크로스체크 유틸
// inventory_logs와 statement_items 사이에는 직접 연결 키가 없으므로
// (품목명, 금액) 기반 멀티셋 차집합으로 매칭한다.

export type SalesLineForMatch = {
  id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  log_date?: string;
  unit?: string;
};

export type StatementItemForMatch = {
  product_name: string;
  amount: number;
};

export type ItemDiff = {
  product_name: string;
  salesAmount: number;
  statementAmount: number;
  diff: number; // sales - statement (양수 = 출고가 더 많음 = 명세서 누락 가능)
  status: "match" | "sales_more" | "statement_more";
};

export type LineMatchStatus = "included" | "missing_estimated" | "amount_mismatch";

export type MatchResult = {
  itemDiffs: ItemDiff[];           // 모든 품목 (diff 큰 순)
  mismatched: ItemDiff[];          // 차이 있는 품목만
  totalSalesAmount: number;
  totalStatementAmount: number;
  totalDiff: number;
  missingLines: SalesLineForMatch[]; // 1:1 매칭으로 "이 행이 누락"이라 단정되는 출고
  matchedRows: Map<string, LineMatchStatus>; // line.id → 매칭 상태
};

function normalize(name: string): string {
  return (name || "").trim().toLowerCase();
}

export function matchSalesToStatements(
  salesLines: SalesLineForMatch[],
  statementItems: StatementItemForMatch[],
): MatchResult {
  const salesByItem = new Map<string, SalesLineForMatch[]>();
  for (const line of salesLines) {
    const key = normalize(line.product_name);
    const arr = salesByItem.get(key) ?? [];
    arr.push(line);
    salesByItem.set(key, arr);
  }

  const stmtByItem = new Map<string, number[]>();
  for (const item of statementItems) {
    const key = normalize(item.product_name);
    const arr = stmtByItem.get(key) ?? [];
    arr.push(item.amount);
    stmtByItem.set(key, arr);
  }

  const allKeys = new Set([...salesByItem.keys(), ...stmtByItem.keys()]);
  const itemDiffs: ItemDiff[] = [];
  const missingLines: SalesLineForMatch[] = [];
  const matchedRows = new Map<string, LineMatchStatus>();

  for (const key of allKeys) {
    const sales = salesByItem.get(key) ?? [];
    const stmtAmounts = [...(stmtByItem.get(key) ?? [])];
    const salesSum = sales.reduce((s, l) => s + l.amount, 0);
    const stmtSum = stmtAmounts.reduce((s, a) => s + a, 0);
    const diff = salesSum - stmtSum;
    const productName = sales[0]?.product_name ?? "(품목)";

    itemDiffs.push({
      product_name: productName,
      salesAmount: salesSum,
      statementAmount: stmtSum,
      diff,
      status: diff === 0 ? "match" : diff > 0 ? "sales_more" : "statement_more",
    });

    // 행별 매칭 휴리스틱
    if (sales.length === 0) continue;

    if (diff === 0) {
      // 합계 일치 → 모두 포함으로 간주
      for (const line of sales) {
        if (line.id) matchedRows.set(line.id, "included");
      }
    } else if (diff > 0) {
      // 출고가 더 많음 → amount 멀티셋 차집합으로 누락 행 추정
      const remaining = [...sales];
      const matched: SalesLineForMatch[] = [];
      for (const stmtAmount of stmtAmounts) {
        const idx = remaining.findIndex((l) => l.amount === stmtAmount);
        if (idx >= 0) {
          matched.push(remaining[idx]);
          remaining.splice(idx, 1);
        }
      }
      // 매칭 안 된 명세서 라인이 남았다면 (예: 합산 라인) 모든 행을 mismatch로 표시
      const stmtMatchedSum = matched.reduce((s, l) => s + l.amount, 0);
      const stmtUnmatchedSum = stmtSum - stmtMatchedSum;

      if (stmtUnmatchedSum === 0) {
        // 깔끔하게 1:1 매칭됨 → remaining만 누락
        for (const line of matched) {
          if (line.id) matchedRows.set(line.id, "included");
        }
        for (const line of remaining) {
          if (line.id) matchedRows.set(line.id, "missing_estimated");
          missingLines.push(line);
        }
      } else {
        // 합산 라인 등으로 1:1 매칭 불가 → 같은 품목 전체를 합계 불일치 처리
        for (const line of sales) {
          if (line.id) matchedRows.set(line.id, "amount_mismatch");
        }
      }
    } else {
      // diff < 0: 명세서가 더 많음 (드문 케이스)
      for (const line of sales) {
        if (line.id) matchedRows.set(line.id, "amount_mismatch");
      }
    }
  }

  const totalSalesAmount = itemDiffs.reduce((s, d) => s + d.salesAmount, 0);
  const totalStatementAmount = itemDiffs.reduce((s, d) => s + d.statementAmount, 0);

  return {
    itemDiffs: itemDiffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)),
    mismatched: itemDiffs.filter((d) => d.diff !== 0),
    totalSalesAmount,
    totalStatementAmount,
    totalDiff: totalSalesAmount - totalStatementAmount,
    missingLines: missingLines.sort((a, b) =>
      (a.log_date ?? "").localeCompare(b.log_date ?? ""),
    ),
    matchedRows,
  };
}

// 카드 헤더용 한 줄 요약 생성
export function summarizeMismatch(result: MatchResult): string | null {
  if (result.totalDiff === 0 && result.mismatched.length === 0) return null;

  // 1:1 누락이 명확하게 식별된 경우 우선 표시
  if (result.missingLines.length > 0 && result.missingLines.length <= 3) {
    const labels = result.missingLines.map(
      (l) => `${l.product_name} ${l.quantity > 1 ? l.quantity + (l.unit || "") : ""}`.trim(),
    );
    const total = result.missingLines.reduce((s, l) => s + l.amount, 0);
    return `명세서 누락 추정: ${labels.join(", ")} (${total.toLocaleString()}원)`;
  }

  if (result.missingLines.length > 3) {
    const total = result.missingLines.reduce((s, l) => s + l.amount, 0);
    return `명세서 누락 추정: ${result.missingLines.length}건 (${total.toLocaleString()}원)`;
  }

  // 합산 라인 등으로 단정 불가 → 품목 합계 차이만
  const sign = result.totalDiff > 0 ? "+" : "";
  return `판매-명세서 차이 ${sign}${result.totalDiff.toLocaleString()}원 (${result.mismatched.length}품목)`;
}
