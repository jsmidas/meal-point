"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbInsert, dbDelete } from "@/lib/db";
import type { Expense } from "@/lib/supabase/types";
import { EXPENSE_CATEGORIES, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Plus, X, Trash2 } from "lucide-react";

interface MonthlySummary {
  month: string;
  revenue: number;
  cost: number;
  expense: number;
  profit: number;
  marginPct: number;
}

export default function PnlPage() {
  const supabase = createClient();

  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlies, setMonthlies] = useState<MonthlySummary[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // 비용 등록 모달
  const [showExpense, setShowExpense] = useState(false);
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expCategory, setExpCategory] = useState("매입");
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState(0);
  const [expNotes, setExpNotes] = useState("");

  // 상세 월
  const [detailMonth, setDetailMonth] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 매출: 판매관리 승인된(sale_checks) 출고 데이터 기준
    const [salesRes, checksRes, productsRes, expRes] = await Promise.all([
      db.from("inventory_logs")
        .select("log_date, company_id, product_id, quantity, unit_price")
        .eq("type", "out")
        .gte("log_date", startDate)
        .lte("log_date", endDate),
      db.from("sale_checks")
        .select("sale_date, company_id")
        .gte("sale_date", startDate)
        .lte("sale_date", endDate),
      db.from("products").select("id, cost_price"),
      db.from("expenses")
        .select("*")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .order("expense_date", { ascending: false }),
    ]);

    // 승인된 날짜+업체 Set
    const confirmedKeys = new Set<string>();
    for (const c of checksRes.data || []) {
      confirmedKeys.add(`${c.sale_date}_${c.company_id}`);
    }

    // 상품 원가 조회
    const costMap: Record<string, number> = {};
    (productsRes.data || []).forEach((p: { id: string; cost_price: number }) => {
      costMap[p.id] = p.cost_price;
    });

    setExpenses(expRes.data || []);

    // 월별 집계
    const monthMap: Record<string, { revenue: number; cost: number; expense: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      monthMap[key] = { revenue: 0, cost: 0, expense: 0 };
    }

    // 매출 + 원가 집계 (승인된 건만)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (salesRes.data || []).forEach((log: any) => {
      const checkKey = `${log.log_date}_${log.company_id}`;
      if (!confirmedKeys.has(checkKey)) return;
      const key = log.log_date?.slice(0, 7);
      if (key && monthMap[key]) {
        monthMap[key].revenue += (log.quantity || 0) * (log.unit_price || 0);
        const unitCost = costMap[log.product_id] || 0;
        monthMap[key].cost += unitCost * (log.quantity || 0);
      }
    });

    // 비용 집계
    (expRes.data || []).forEach((e: Expense) => {
      const key = e.expense_date.slice(0, 7);
      if (monthMap[key]) monthMap[key].expense += e.amount;
    });

    const summaries: MonthlySummary[] = Object.entries(monthMap).map(([month, d]) => {
      const profit = d.revenue - d.cost - d.expense;
      const marginPct = d.revenue > 0 ? Math.round((profit / d.revenue) * 100) : 0;
      return { month, revenue: d.revenue, cost: d.cost, expense: d.expense, profit, marginPct };
    });

    setMonthlies(summaries);
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [year]);

  // 연간 합계
  const totals = monthlies.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      cost: acc.cost + m.cost,
      expense: acc.expense + m.expense,
      profit: acc.profit + m.profit,
    }),
    { revenue: 0, cost: 0, expense: 0, profit: 0 },
  );
  const totalMargin = totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 100) : 0;

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expDesc || expAmount <= 0) return;
    await dbInsert("expenses", {
      expense_date: expDate,
      category: expCategory,
      description: expDesc,
      amount: expAmount,
      notes: expNotes || null,
    });
    setShowExpense(false);
    setExpDesc("");
    setExpAmount(0);
    setExpNotes("");
    fetchData();
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm("이 비용을 삭제하시겠습니까?")) return;
    await dbDelete("expenses", { id });
    fetchData();
  }

  const detailExpenses = detailMonth
    ? expenses.filter((e) => e.expense_date.slice(0, 7) === detailMonth)
    : [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">손익 현황</h1>
        <div className="flex gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-4 py-2.5 rounded-xl border border-border bg-bg-card text-text-primary focus:outline-none focus:border-primary transition-colors"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <button
            onClick={() => setShowExpense(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
          >
            <Plus size={18} /> 비용 등록
          </button>
        </div>
      </div>

      {/* 연간 요약 카드 */}
      <div className="grid sm:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-400" />
            <p className="text-sm text-text-muted">연간 매출</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatNumber(totals.revenue)}원</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-blue-400" />
            <p className="text-sm text-text-muted">매출원가</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">{formatNumber(totals.cost)}원</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={16} className="text-red-400" />
            <p className="text-sm text-text-muted">판관비</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatNumber(totals.expense)}원</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-sm text-text-muted mb-1">순이익 (마진율)</p>
          <p className={`text-2xl font-bold ${totals.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatNumber(totals.profit)}원
            <span className="text-sm ml-2">({totalMargin}%)</span>
          </p>
        </div>
      </div>

      {/* 월별 테이블 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="px-4 py-3 text-left text-text-muted font-medium">월</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">매출</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">원가</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">판관비</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">순이익</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">마진율</th>
                </tr>
              </thead>
              <tbody>
                {monthlies.map((m) => (
                  <tr
                    key={m.month}
                    className="border-b border-border hover:bg-bg-card-hover cursor-pointer transition-colors"
                    onClick={() => setDetailMonth(detailMonth === m.month ? null : m.month)}
                  >
                    <td className="px-4 py-3 text-text-primary font-medium">{m.month}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{formatNumber(m.revenue)}</td>
                    <td className="px-4 py-3 text-right text-blue-400">{formatNumber(m.cost)}</td>
                    <td className="px-4 py-3 text-right text-red-400">{formatNumber(m.expense)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${m.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatNumber(m.profit)}
                    </td>
                    <td className={`px-4 py-3 text-right ${m.marginPct >= 0 ? "text-text-primary" : "text-red-400"}`}>
                      {m.marginPct}%
                    </td>
                  </tr>
                ))}
                {/* 합계 행 */}
                <tr className="bg-bg-dark font-bold">
                  <td className="px-4 py-3 text-text-primary">합계</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{formatNumber(totals.revenue)}</td>
                  <td className="px-4 py-3 text-right text-blue-400">{formatNumber(totals.cost)}</td>
                  <td className="px-4 py-3 text-right text-red-400">{formatNumber(totals.expense)}</td>
                  <td className={`px-4 py-3 text-right ${totals.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatNumber(totals.profit)}
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">{totalMargin}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 월별 비용 상세 */}
      {detailMonth && (
        <div className="rounded-2xl border border-border bg-bg-card p-6 mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4">{detailMonth} 비용 내역</h2>
          {detailExpenses.length === 0 ? (
            <p className="text-text-muted text-sm">등록된 비용이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {detailExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-bg-dark transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">{e.category}</span>
                    <span className="text-text-primary text-sm">{e.description}</span>
                    {e.notes && <span className="text-text-muted text-xs">({e.notes})</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-red-400 font-medium text-sm">{formatNumber(e.amount)}원</span>
                    <button onClick={() => handleDeleteExpense(e.id)} className="p-1 rounded hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 비용 등록 모달 */}
      {showExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">비용 등록</h2>
              <button onClick={() => setShowExpense(false)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">날짜</label>
                  <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">카테고리</label>
                  <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary">
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">내용 <span className="text-red-400">*</span></label>
                  <input type="text" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">금액 <span className="text-red-400">*</span></label>
                  <input type="number" min={1} value={expAmount} onChange={(e) => setExpAmount(Number(e.target.value))} required className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">메모</label>
                  <input type="text" value={expNotes} onChange={(e) => setExpNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowExpense(false)} className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors">등록</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
