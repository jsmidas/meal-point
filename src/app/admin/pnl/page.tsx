"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbInsert, dbUpdate, dbDelete } from "@/lib/db";
import type { Expense } from "@/lib/supabase/types";
import { EXPENSE_CATEGORIES, EXPENSE_FIXED_CATEGORIES, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Plus, X, Trash2, Info, Printer, Pencil } from "lucide-react";

/**
 * 손익 현황
 *  - 표 1: 월별 손익 + 누계 (업체별 매출 → 매출 합계 → 매출원가 → 매출총이익 → 판관비(항목별, 셀에서 바로 입력) → 순이익)
 *  - 표 2: 제품 × 업체 판매 매트릭스 (수량/금액, 제품별 적용 매입단가·원가·총이익)
 * 원가: 판매일 기준 단가 이력(company_price_history, price_type='cost')의 매입가, 없으면 상품 매입가.
 * 자가소비(self): '자가소비' 행으로 따로 보이되 판매가 기준으로 매출·원가에 포함(원가는 기록 시점 매입가).
 */

interface SaleLog {
  id: string;
  log_date: string;
  company_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  type: string;
  reason: string | null;
}
interface ProductLite { id: string; name: string; cost_price: number; box_quantity: number | null; unit: string }
interface CompanyLite { id: string; name: string }
interface CostHist { product_id: string; price: number; effective_from: string; created_at: string }

const SELF_KEY = "__self__";
const MANUAL_KEY = "__manual__";
const NEW_CATEGORY = "__new__";

export default function PnlPage() {
  const supabase = createClient();

  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [costHistory, setCostHistory] = useState<CostHist[]>([]);

  // 매트릭스 표 옵션
  const [matrixMonth, setMatrixMonth] = useState<string>("all"); // 'all' | 'YYYY-MM'
  const [matrixMode, setMatrixMode] = useState<"qty" | "amount">("amount");

  // 비용 등록 모달
  const [showExpense, setShowExpense] = useState(false);
  const [expMonth, setExpMonth] = useState<string | null>(null);
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expCategory, setExpCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expNewCategory, setExpNewCategory] = useState(""); // '직접 입력' 선택 시 새 항목명
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null); // null=신규, string=수정
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState(0);
  const [expNotes, setExpNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`), [year]);

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [salesRes, checksRes, prodRes, compRes, histRes, expRes] = await Promise.all([
      db.from("inventory_logs")
        .select("id, log_date, company_id, product_id, quantity, unit_price, cost_price, type, reason")
        .in("type", ["out", "self"])
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .limit(10000),
      db.from("sale_checks").select("sale_date, company_id").gte("sale_date", startDate).lte("sale_date", endDate),
      db.from("products").select("id, name, cost_price, box_quantity, unit").order("name"),
      db.from("companies").select("id, name").order("name"),
      db.from("company_price_history").select("product_id, price, effective_from, created_at").eq("price_type", "cost").gt("price", 0).order("effective_from", { ascending: true }).order("created_at", { ascending: true }),
      db.from("expenses").select("*").gte("expense_date", startDate).lte("expense_date", endDate).order("expense_date", { ascending: false }),
    ]);

    // 판매 승인(sale_checks)된 날짜+업체만 매출로 인정. 자가소비는 승인 개념이 없으므로 전부 포함.
    const confirmed = new Set<string>();
    for (const c of checksRes.data || []) confirmed.add(`${c.sale_date}_${c.company_id}`);
    const rows: SaleLog[] = (salesRes.data || []).filter((l: SaleLog) => l.type === "self" || confirmed.has(`${l.log_date}_${l.company_id}`));

    setSales(rows);
    setProducts(prodRes.data || []);
    setCompanies(compRes.data || []);
    setCostHistory(histRes.data || []);
    setExpenses(expRes.data || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [year]);

  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name || "(미지정)";

  /** 판매일 기준 적용 매입단가: 단가 이력(effective_from <= 판매일) 중 최신(같은 날이면 나중 등록), 없으면 상품 매입가.
   *  0원 행('기본가 복귀' 등)은 조회 단계에서 제외한다. */
  const costAt = useMemo(() => {
    const byProduct = new Map<string, CostHist[]>();
    for (const h of costHistory) {
      const arr = byProduct.get(h.product_id) || [];
      arr.push(h);
      byProduct.set(h.product_id, arr);
    }
    return (productId: string | null, date: string): number => {
      if (!productId) return 0;
      const hist = byProduct.get(productId);
      if (hist) {
        let found: number | null = null;
        for (const h of hist) {
          if (h.effective_from <= date) found = h.price;
          else break;
        }
        if (found !== null) return found;
      }
      return productMap[productId]?.cost_price || 0;
    };
  }, [costHistory, productMap]);

  /** 로그 한 건의 매출·원가 */
  const amountOf = (l: SaleLog) => l.quantity * (l.unit_price || 0);
  const costOf = (l: SaleLog) => l.type === "self" ? l.quantity * (l.cost_price || 0) : l.quantity * costAt(l.product_id, l.log_date);

  // ── 표 1: 월별 손익 ──
  const pnl = useMemo(() => {
    const zero = () => Object.fromEntries(months.map((m) => [m, 0])) as Record<string, number>;
    const revenueByCompany = new Map<string, Record<string, number>>(); // company_id | SELF_KEY → month → 매출
    const manual = zero();
    const cogs = zero();
    const revenue = zero();
    const selfCost = zero();

    for (const l of sales) {
      const m = l.log_date.slice(0, 7);
      if (!(m in revenue)) continue;
      const amt = amountOf(l);
      const key = l.type === "self" ? SELF_KEY : l.company_id || "__none__";
      const row = revenueByCompany.get(key) || zero();
      row[m] += amt;
      revenueByCompany.set(key, row);
      revenue[m] += amt;
      const c = costOf(l);
      cogs[m] += c;
      if (l.type === "self") selfCost[m] += c;
      if (!l.product_id && l.type !== "self") manual[m] += amt;
    }

    const expenseByCat = new Map<string, Record<string, number>>();
    const opex = zero();
    for (const e of expenses) {
      const m = e.expense_date.slice(0, 7);
      if (!(m in opex)) continue;
      const row = expenseByCat.get(e.category) || zero();
      row[m] += e.amount;
      expenseByCat.set(e.category, row);
      opex[m] += e.amount;
    }
    // 항상 보이는 항목 + 실제 입력된 항목
    const categories = [...EXPENSE_FIXED_CATEGORIES, ...[...expenseByCat.keys()].filter((c) => !EXPENSE_FIXED_CATEGORIES.includes(c)).sort()];
    for (const c of categories) if (!expenseByCat.has(c)) expenseByCat.set(c, zero());

    const sum = (r: Record<string, number>) => months.reduce((s, m) => s + r[m], 0);
    const companyRows = [...revenueByCompany.entries()]
      .filter(([k]) => k !== SELF_KEY)
      .map(([id, row]) => ({ id, name: id === "__none__" ? "(거래처 미지정)" : companyName(id), row, total: sum(row) }))
      .sort((a, b) => b.total - a.total);
    const selfRow = revenueByCompany.get(SELF_KEY) || zero();

    const gross = zero(); const net = zero();
    for (const m of months) { gross[m] = revenue[m] - cogs[m]; net[m] = gross[m] - opex[m]; }

    return { companyRows, selfRow, manual, revenue, cogs, gross, categories, expenseByCat, opex, net, selfCost, sum };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, expenses, months, companies, costAt]);

  const totals = {
    revenue: pnl.sum(pnl.revenue),
    cogs: pnl.sum(pnl.cogs),
    gross: pnl.sum(pnl.gross),
    opex: pnl.sum(pnl.opex),
    net: pnl.sum(pnl.net),
    self: pnl.sum(pnl.selfRow),
  };
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

  // ── 표 2: 제품 × 업체 매트릭스 ──
  const matrix = useMemo(() => {
    const inPeriod = sales.filter((l) => matrixMonth === "all" ? l.log_date.startsWith(String(year)) : l.log_date.startsWith(matrixMonth));
    type Cell = { qty: number; amount: number };
    const cells = new Map<string, Map<string, Cell>>(); // productKey → companyKey → cell
    const prodTotals = new Map<string, { qty: number; amount: number; cost: number }>();
    const compTotals = new Map<string, Cell>();
    for (const l of inPeriod) {
      const pk = l.product_id || MANUAL_KEY;
      const ck = l.type === "self" ? SELF_KEY : l.company_id || "__none__";
      const amt = amountOf(l);
      const row = cells.get(pk) || new Map<string, Cell>();
      const cell = row.get(ck) || { qty: 0, amount: 0 };
      cell.qty += l.quantity; cell.amount += amt;
      row.set(ck, cell); cells.set(pk, row);
      const pt = prodTotals.get(pk) || { qty: 0, amount: 0, cost: 0 };
      pt.qty += l.quantity; pt.amount += amt; pt.cost += costOf(l);
      prodTotals.set(pk, pt);
      const ct = compTotals.get(ck) || { qty: 0, amount: 0 };
      ct.qty += l.quantity; ct.amount += amt;
      compTotals.set(ck, ct);
    }
    const companyKeys = [...compTotals.entries()].sort((a, b) => {
      if (a[0] === SELF_KEY) return 1; if (b[0] === SELF_KEY) return -1;
      return b[1].amount - a[1].amount;
    }).map(([k]) => k);
    const productKeys = [...prodTotals.entries()].sort((a, b) => {
      if (a[0] === MANUAL_KEY) return 1; if (b[0] === MANUAL_KEY) return -1;
      return b[1].amount - a[1].amount;
    }).map(([k]) => k);
    const grand = [...prodTotals.values()].reduce((s, t) => ({ qty: s.qty + t.qty, amount: s.amount + t.amount, cost: s.cost + t.cost }), { qty: 0, amount: 0, cost: 0 });
    return { cells, prodTotals, compTotals, companyKeys, productKeys, grand };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, matrixMonth, year, costAt]);

  const colLabel = (key: string) => key === SELF_KEY ? "자가소비" : key === "__none__" ? "(미지정)" : companyName(key);
  const rowLabel = (key: string) => key === MANUAL_KEY ? "수작업 항목(물류비 등)" : productMap[key]?.name || key.slice(0, 8);

  // ── 비용 등록 ──
  function openExpense(month: string | null, category?: string) {
    setExpMonth(month);
    const today = new Date().toISOString().slice(0, 10);
    setExpDate(month && !today.startsWith(month) ? `${month}-01` : today);
    setExpCategory(category || EXPENSE_CATEGORIES[0]);
    setExpNewCategory("");
    setExpDesc("");
    setExpAmount(0);
    setExpNotes("");
    setEditingExpenseId(null);
    setShowExpense(true);
  }

  /** 기존 비용을 폼에 불러와 수정 모드로 */
  function startEditExpense(x: Expense) {
    setEditingExpenseId(x.id);
    setExpDate(x.expense_date);
    setExpCategory(x.category);
    setExpNewCategory("");
    setExpDesc(x.description);
    setExpAmount(x.amount);
    setExpNotes(x.notes || "");
  }

  function cancelEditExpense() {
    setEditingExpenseId(null);
    setExpDesc("");
    setExpAmount(0);
    setExpNotes("");
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expDesc || expAmount <= 0) return;
    const category = expCategory === NEW_CATEGORY ? expNewCategory.trim() : expCategory;
    if (!category) return;
    setSaving(true);
    const payload = {
      expense_date: expDate,
      category,
      description: expDesc,
      amount: expAmount,
      notes: expNotes || null,
    };
    if (editingExpenseId) {
      await dbUpdate("expenses", payload, { id: editingExpenseId });
      setEditingExpenseId(null);
    } else {
      await dbInsert("expenses", payload);
    }
    setSaving(false);
    // 새 항목으로 등록했으면 그 항목을 선택 상태로 유지(연속 입력)
    if (expCategory === NEW_CATEGORY) { setExpCategory(category); setExpNewCategory(""); }
    setExpDesc("");
    setExpAmount(0);
    setExpNotes("");
    await fetchData();
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm("이 비용을 삭제하시겠습니까?")) return;
    await dbDelete("expenses", { id });
    if (editingExpenseId === id) cancelEditExpense();
    fetchData();
  }

  const modalExpenses = expenses.filter((x) => x.expense_date.startsWith(expDate.slice(0, 7)) && x.category === expCategory);
  /** 항목 선택지: 기본 목록 + 지금까지 등록된 항목(사용자가 직접 추가한 것 포함) */
  const expenseCategoryOptions = useMemo(
    () => [...EXPENSE_CATEGORIES, ...[...new Set(expenses.map((x) => x.category))].filter((c) => !EXPENSE_CATEGORIES.includes(c)).sort()],
    [expenses],
  );

  const cellCls = "px-3 py-2 text-right whitespace-nowrap";
  const headCls = "px-3 py-2 text-right text-text-muted font-medium whitespace-nowrap";
  const money = (n: number) => (n === 0 ? <span className="text-text-muted/40">-</span> : formatNumber(n));

  const matrixLabel = matrixMonth === "all" ? `${year}년 누계` : `${year}년 ${Number(matrixMonth.slice(5))}월`;

  return (
    <div className="pnl-print">
      {/* 인쇄 시 A4 가로 */}
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm 12mm; } }`}</style>

      {/* 인쇄 전용 머리글 */}
      <div className="hidden print-only mb-3">
        <div className="flex items-baseline justify-between">
          <h1 className="font-bold">{year}년 손익 현황</h1>
          <span className="text-xs">출력일 {new Date().toLocaleDateString("ko-KR")}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print-hide">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">손익 현황</h1>
          <p className="text-sm text-text-muted mt-1">
            업체별 매출 → 매출원가(판매일 기준 매입가) → 판관비 → 순이익. 자가소비는 따로 보이되 판매가로 매출에 포함합니다.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors"
            title="A4 가로로 인쇄"
          >
            <Printer size={16} /> 인쇄
          </button>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="연도"
            className="px-4 py-2.5 rounded-xl border border-border bg-bg-card text-text-primary focus:outline-none focus:border-primary transition-colors"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <button
            onClick={() => openExpense(null)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
          >
            <Plus size={18} /> 판관비 등록
          </button>
        </div>
      </div>

      {/* 연간 요약 카드 */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 pnl-cards">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-400" />
            <p className="text-sm text-text-muted">연간 매출</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatNumber(totals.revenue)}원</p>
          {totals.self > 0 && <p className="text-[11px] text-violet-400 mt-1">자가소비 {formatNumber(totals.self)}원 포함</p>}
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-blue-400" />
            <p className="text-sm text-text-muted">매출원가</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">{formatNumber(totals.cogs)}원</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-sm text-text-muted mb-1">매출총이익</p>
          <p className="text-2xl font-bold text-text-primary">
            {formatNumber(totals.gross)}원
            <span className="text-sm ml-2 text-text-muted">({pct(totals.gross, totals.revenue)}%)</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={16} className="text-red-400" />
            <p className="text-sm text-text-muted">판관비</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatNumber(totals.opex)}원</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-sm text-text-muted mb-1">순이익 (순이익률)</p>
          <p className={`text-2xl font-bold ${totals.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatNumber(totals.net)}원
            <span className="text-sm ml-2">({pct(totals.net, totals.revenue)}%)</span>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : (
        <>
          {/* 표 1: 월별 손익 + 누계 */}
          <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-8 pnl-section pnl-main">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{year}년 월별 손익 · 누계</h2>
              <span className="text-xs text-text-muted inline-flex items-center gap-1 print-hide">
                <Info size={12} /> 판관비 칸을 누르면 그 달·항목으로 바로 등록됩니다.
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-bg-dark">
                    <th className="px-3 py-2 text-left text-text-muted font-medium sticky left-0 bg-bg-dark min-w-[160px]">항목</th>
                    {months.map((m) => (
                      <th key={m} className={headCls}>{Number(m.slice(5))}월</th>
                    ))}
                    <th className={`${headCls} text-text-primary border-l border-border`}>누계</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 업체별 매출 */}
                  {pnl.companyRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 hover:bg-bg-card-hover transition-colors">
                      <td className="px-3 py-1.5 text-text-secondary sticky left-0 bg-bg-card pl-5">{r.name}</td>
                      {months.map((m) => <td key={m} className={`${cellCls} text-text-secondary`}>{money(r.row[m])}</td>)}
                      <td className={`${cellCls} text-text-primary font-medium border-l border-border`}>{formatNumber(r.total)}</td>
                    </tr>
                  ))}
                  {totals.self > 0 && (
                    <tr className="border-b border-border/60 bg-violet-500/5">
                      <td className="px-3 py-1.5 text-violet-400 sticky left-0 bg-bg-card pl-5">자가소비 (판매가 기준)</td>
                      {months.map((m) => <td key={m} className={`${cellCls} text-violet-400`}>{money(pnl.selfRow[m])}</td>)}
                      <td className={`${cellCls} text-violet-400 font-medium border-l border-border`}>{formatNumber(totals.self)}</td>
                    </tr>
                  )}
                  <tr className="border-b border-border bg-bg-dark/60 font-bold">
                    <td className="px-3 py-2 text-emerald-400 sticky left-0 bg-bg-dark">매출 합계</td>
                    {months.map((m) => <td key={m} className={`${cellCls} text-emerald-400`}>{money(pnl.revenue[m])}</td>)}
                    <td className={`${cellCls} text-emerald-400 border-l border-border`}>{formatNumber(totals.revenue)}</td>
                  </tr>
                  {pnl.sum(pnl.manual) > 0 && (
                    <tr className="border-b border-border/60">
                      <td className="px-3 py-1.5 text-text-muted sticky left-0 bg-bg-card pl-5 italic">└ 수작업 항목(물류비 등, 원가 0)</td>
                      {months.map((m) => <td key={m} className={`${cellCls} text-text-muted italic`}>{money(pnl.manual[m])}</td>)}
                      <td className={`${cellCls} text-text-muted italic border-l border-border`}>{formatNumber(pnl.sum(pnl.manual))}</td>
                    </tr>
                  )}
                  {/* 원가 · 총이익 */}
                  <tr className="border-b border-border">
                    <td className="px-3 py-2 text-blue-400 sticky left-0 bg-bg-card">매출원가</td>
                    {months.map((m) => <td key={m} className={`${cellCls} text-blue-400`}>{money(pnl.cogs[m])}</td>)}
                    <td className={`${cellCls} text-blue-400 font-medium border-l border-border`}>{formatNumber(totals.cogs)}</td>
                  </tr>
                  <tr className="border-b border-border bg-bg-dark/60 font-bold">
                    <td className="px-3 py-2 text-text-primary sticky left-0 bg-bg-dark">매출총이익</td>
                    {months.map((m) => (
                      <td key={m} className={`${cellCls} ${pnl.gross[m] < 0 ? "text-red-400" : "text-text-primary"}`}>
                        {money(pnl.gross[m])}
                        {pnl.revenue[m] > 0 && <span className="block text-[10px] font-normal text-text-muted">{pct(pnl.gross[m], pnl.revenue[m])}%</span>}
                      </td>
                    ))}
                    <td className={`${cellCls} border-l border-border ${totals.gross < 0 ? "text-red-400" : "text-text-primary"}`}>
                      {formatNumber(totals.gross)}
                      <span className="block text-[10px] font-normal text-text-muted">{pct(totals.gross, totals.revenue)}%</span>
                    </td>
                  </tr>
                  {/* 판관비 (항목별, 셀 클릭 입력) */}
                  {pnl.categories.map((cat) => {
                    const row = pnl.expenseByCat.get(cat)!;
                    return (
                      <tr key={cat} className="border-b border-border/60">
                        <td className="px-3 py-1.5 text-red-300/90 sticky left-0 bg-bg-card pl-5">{cat}</td>
                        {months.map((m) => (
                          <td key={m} className="p-0 text-right">
                            <button
                              type="button"
                              onClick={() => openExpense(m, cat)}
                              title={`${Number(m.slice(5))}월 ${cat} 등록/보기`}
                              className="w-full h-full px-3 py-1.5 text-right text-red-300/90 hover:bg-red-400/10 hover:text-red-300 transition-colors group"
                            >
                              {row[m] > 0 ? formatNumber(row[m]) : <span className="text-text-muted/30 group-hover:text-red-300">+</span>}
                            </button>
                          </td>
                        ))}
                        <td className={`${cellCls} text-red-300/90 font-medium border-l border-border`}>{formatNumber(pnl.sum(row))}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-b border-border/60 print-hide">
                    <td colSpan={months.length + 2} className="px-3 py-1 sticky left-0 bg-bg-card">
                      <button
                        type="button"
                        onClick={() => openExpense(null, NEW_CATEGORY)}
                        className="inline-flex items-center gap-1 pl-2 text-xs text-text-muted hover:text-primary transition-colors"
                      >
                        <Plus size={12} /> 판관비 항목 추가 (예: 차량유지비, 통신비)
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-border bg-bg-dark/60 font-bold">
                    <td className="px-3 py-2 text-red-400 sticky left-0 bg-bg-dark">판관비 합계</td>
                    {months.map((m) => <td key={m} className={`${cellCls} text-red-400`}>{money(pnl.opex[m])}</td>)}
                    <td className={`${cellCls} text-red-400 border-l border-border`}>{formatNumber(totals.opex)}</td>
                  </tr>
                  {/* 순이익 */}
                  <tr className="bg-bg-dark font-bold">
                    <td className="px-3 py-2.5 text-text-primary sticky left-0 bg-bg-dark">순이익</td>
                    {months.map((m) => (
                      <td key={m} className={`${cellCls} ${pnl.net[m] < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {money(pnl.net[m])}
                        {pnl.revenue[m] > 0 && <span className="block text-[10px] font-normal text-text-muted">{pct(pnl.net[m], pnl.revenue[m])}%</span>}
                      </td>
                    ))}
                    <td className={`${cellCls} border-l border-border ${totals.net < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {formatNumber(totals.net)}
                      <span className="block text-[10px] font-normal text-text-muted">{pct(totals.net, totals.revenue)}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 표 2: 제품 × 업체 */}
          <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-8 pnl-section pnl-matrix">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                제품 × 업체 판매
                <span className="hidden print-only text-xs font-normal ml-2">({matrixLabel} · {matrixMode === "amount" ? "금액" : "수량"})</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2 print-hide">
                <select
                  value={matrixMonth}
                  onChange={(e) => setMatrixMonth(e.target.value)}
                  aria-label="기간"
                  className="px-3 py-1.5 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                >
                  <option value="all">{year}년 누계</option>
                  {months.map((m) => <option key={m} value={m}>{Number(m.slice(5))}월</option>)}
                </select>
                <div className="flex gap-1 p-1 rounded-lg bg-bg-dark border border-border">
                  {(["amount", "qty"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMatrixMode(k)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${matrixMode === k ? "bg-primary/20 text-primary" : "text-text-muted hover:text-text-primary"}`}
                    >
                      {k === "amount" ? "금액" : "수량"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {matrix.productKeys.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-text-muted">해당 기간 판매가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-bg-dark">
                      <th className="px-3 py-2 text-left text-text-muted font-medium sticky left-0 bg-bg-dark min-w-[150px]">제품</th>
                      {matrix.companyKeys.map((ck) => (
                        <th key={ck} className={`${headCls} ${ck === SELF_KEY ? "text-violet-400" : ""}`}>{colLabel(ck)}</th>
                      ))}
                      <th className={`${headCls} text-text-primary border-l border-border`}>수량</th>
                      <th className={`${headCls} text-emerald-400`}>매출</th>
                      <th className={`${headCls} print-hide`}>적용 매입단가</th>
                      <th className={`${headCls} text-blue-400 print-hide`}>원가</th>
                      <th className={`${headCls} text-text-primary print-hide`}>총이익</th>
                      <th className={`${headCls} print-hide`}>이익률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.productKeys.map((pk) => {
                      const t = matrix.prodTotals.get(pk)!;
                      const row = matrix.cells.get(pk)!;
                      const gross = t.amount - t.cost;
                      const bq = productMap[pk]?.box_quantity ?? 1;
                      return (
                        <tr key={pk} className="border-b border-border/60 hover:bg-bg-card-hover transition-colors">
                          <td className="px-3 py-1.5 text-text-primary font-medium sticky left-0 bg-bg-card">
                            {rowLabel(pk)}
                            {bq > 1 && <span className="block text-[10px] text-text-muted font-normal">{bq}개/박스</span>}
                          </td>
                          {matrix.companyKeys.map((ck) => {
                            const c = row.get(ck);
                            return (
                              <td key={ck} className={`${cellCls} ${ck === SELF_KEY ? "text-violet-400" : "text-text-secondary"}`}>
                                {!c ? <span className="text-text-muted/30">-</span> : matrixMode === "amount" ? formatNumber(c.amount) : formatNumber(c.qty)}
                              </td>
                            );
                          })}
                          <td className={`${cellCls} text-text-primary border-l border-border`}>
                            {formatNumber(t.qty)}
                            {bq > 1 && <span className="block text-[10px] text-text-muted">{(t.qty / bq).toFixed(1)}박스</span>}
                          </td>
                          <td className={`${cellCls} text-emerald-400 font-medium`}>{formatNumber(t.amount)}</td>
                          <td className={`${cellCls} text-text-secondary print-hide`}>{t.qty > 0 && pk !== MANUAL_KEY ? formatNumber(Math.round(t.cost / t.qty)) : "-"}</td>
                          <td className={`${cellCls} text-blue-400 print-hide`}>{formatNumber(t.cost)}</td>
                          <td className={`${cellCls} font-medium print-hide ${gross < 0 ? "text-red-400" : "text-text-primary"}`}>{formatNumber(gross)}</td>
                          <td className={`${cellCls} text-text-secondary print-hide`}>{t.amount > 0 ? `${pct(gross, t.amount)}%` : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-bg-dark font-bold">
                      <td className="px-3 py-2 text-text-primary sticky left-0 bg-bg-dark">합계</td>
                      {matrix.companyKeys.map((ck) => {
                        const c = matrix.compTotals.get(ck)!;
                        return (
                          <td key={ck} className={`${cellCls} ${ck === SELF_KEY ? "text-violet-400" : "text-text-primary"}`}>
                            {matrixMode === "amount" ? formatNumber(c.amount) : formatNumber(c.qty)}
                          </td>
                        );
                      })}
                      <td className={`${cellCls} text-text-primary border-l border-border`}>{formatNumber(matrix.grand.qty)}</td>
                      <td className={`${cellCls} text-emerald-400`}>{formatNumber(matrix.grand.amount)}</td>
                      <td className="print-hide" />
                      <td className={`${cellCls} text-blue-400 print-hide`}>{formatNumber(matrix.grand.cost)}</td>
                      <td className={`${cellCls} print-hide ${matrix.grand.amount - matrix.grand.cost < 0 ? "text-red-400" : "text-text-primary"}`}>{formatNumber(matrix.grand.amount - matrix.grand.cost)}</td>
                      <td className={`${cellCls} text-text-secondary print-hide`}>{matrix.grand.amount > 0 ? `${pct(matrix.grand.amount - matrix.grand.cost, matrix.grand.amount)}%` : "-"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="px-6 py-2 text-[11px] text-text-muted border-t border-border">
              적용 매입단가 = 판매일 기준 단가 이력의 매입가(없으면 상품 매입가), 수량 가중 평균. 자가소비는 기록 시점 매입가. 수작업 항목은 원가 0.
            </p>
          </div>

          {/* 인쇄 전용: 제품별 원가·총이익 (화면에서는 매트릭스 오른쪽 열로 표시) */}
          {matrix.productKeys.length > 0 && (
            <div className="hidden print-only pnl-section pnl-product-summary">
              <h2 className="font-semibold mb-1">제품별 매출·원가·총이익 ({matrixLabel})</h2>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">제품</th>
                    <th className="text-right">수량</th>
                    <th className="text-right">매출</th>
                    <th className="text-right">적용 매입단가</th>
                    <th className="text-right">원가</th>
                    <th className="text-right">총이익</th>
                    <th className="text-right">이익률</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.productKeys.map((pk) => {
                    const t = matrix.prodTotals.get(pk)!;
                    const gross = t.amount - t.cost;
                    return (
                      <tr key={pk}>
                        <td>{rowLabel(pk)}</td>
                        <td className="text-right">{formatNumber(t.qty)}</td>
                        <td className="text-right">{formatNumber(t.amount)}</td>
                        <td className="text-right">{t.qty > 0 && pk !== MANUAL_KEY ? formatNumber(Math.round(t.cost / t.qty)) : "-"}</td>
                        <td className="text-right">{formatNumber(t.cost)}</td>
                        <td className="text-right">{formatNumber(gross)}</td>
                        <td className="text-right">{t.amount > 0 ? `${pct(gross, t.amount)}%` : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>합계</td>
                    <td className="text-right">{formatNumber(matrix.grand.qty)}</td>
                    <td className="text-right">{formatNumber(matrix.grand.amount)}</td>
                    <td />
                    <td className="text-right">{formatNumber(matrix.grand.cost)}</td>
                    <td className="text-right">{formatNumber(matrix.grand.amount - matrix.grand.cost)}</td>
                    <td className="text-right">{matrix.grand.amount > 0 ? `${pct(matrix.grand.amount - matrix.grand.cost, matrix.grand.amount)}%` : "-"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* 판관비 등록 모달 */}
      {showExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">
                {editingExpenseId ? "판관비 수정" : "판관비 등록"}
                {!editingExpenseId && expMonth && <span className="text-sm font-normal text-text-muted ml-2">{Number(expMonth.slice(5))}월</span>}
              </h2>
              <button type="button" onClick={() => setShowExpense(false)} title="닫기" className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">일자</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                    aria-label="일자"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">항목</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    aria-label="항목"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  >
                    {expenseCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value={NEW_CATEGORY}>+ 새 항목 직접 입력</option>
                  </select>
                </div>
              </div>
              {expCategory === NEW_CATEGORY && (
                <div>
                  <label className="block text-sm text-text-secondary mb-1">새 항목명 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={expNewCategory}
                    onChange={(e) => setExpNewCategory(e.target.value)}
                    placeholder="예: 차량유지비, 통신비"
                    required
                    maxLength={30}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  />
                  <p className="text-xs text-text-muted mt-1">등록하면 손익표에 이 항목 행이 자동으로 생기고, 다음부터 목록에서 고를 수 있습니다.</p>
                </div>
              )}
              <div>
                <label className="block text-sm text-text-secondary mb-1">내용 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="예: 네이버 광고, 포장박스 500매"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">금액 <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  min={0}
                  value={expAmount || ""}
                  onChange={(e) => setExpAmount(Number(e.target.value))}
                  required
                  aria-label="금액"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">비고</label>
                <input
                  type="text"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-1">
                {editingExpenseId ? (
                  <button type="button" onClick={cancelEditExpense} className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">
                    수정 취소
                  </button>
                ) : (
                  <button type="button" onClick={() => setShowExpense(false)} className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">
                    닫기
                  </button>
                )}
                <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50">
                  {saving ? "저장 중..." : editingExpenseId ? "수정 저장" : "등록"}
                </button>
              </div>

              {/* 같은 달·항목의 기존 내역 */}
              <div className="border-t border-border pt-4">
                <p className="text-xs text-text-muted mb-2">
                  {Number(expDate.slice(5, 7))}월 {expCategory} 내역 ({modalExpenses.length}건 · {formatNumber(modalExpenses.reduce((s, x) => s + x.amount, 0))}원)
                </p>
                {modalExpenses.length === 0 ? (
                  <p className="text-xs text-text-muted/60">등록된 내역이 없습니다.</p>
                ) : (
                  <ul className="space-y-1">
                    {modalExpenses.map((x) => (
                      <li
                        key={x.id}
                        className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${editingExpenseId === x.id ? "bg-primary/10 ring-1 ring-primary/50" : "bg-bg-dark"}`}
                      >
                        <span className="text-text-muted w-16 shrink-0">{x.expense_date.slice(5)}</span>
                        <span className="flex-1 text-text-primary truncate">{x.description}{x.notes && <span className="text-text-muted"> · {x.notes}</span>}</span>
                        <span className="text-red-300 font-medium">{formatNumber(x.amount)}</span>
                        <button type="button" onClick={() => startEditExpense(x)} title="수정" className="p-1 rounded text-text-muted hover:text-primary">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => handleDeleteExpense(x.id)} title="삭제" className="p-1 rounded text-text-muted hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
