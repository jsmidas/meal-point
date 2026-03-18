"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company, Statement, BillingWithPayments, Payment } from "@/lib/supabase/types";
import { formatNumber, generateBillingNumber } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  CreditCard,
  X,
  CheckCircle2,
  Circle,
  Plus,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";

type SalesData = { amount: number; count: number };

type CompanyRow = {
  id: string;
  name: string;
  sales: SalesData;
  statements: Statement[];
  billing: BillingWithPayments | null;
};

export default function BillingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [companyRows, setCompanyRows] = useState<CompanyRow[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // 세금계산서 모달
  const [taxModal, setTaxModal] = useState<BillingWithPayments | null>(null);
  const [taxDate, setTaxDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxNumber, setTaxNumber] = useState("");

  // 입금 모달
  const [payModal, setPayModal] = useState<BillingWithPayments | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payNotes, setPayNotes] = useState("");

  // 청구 생성 모달
  const [billingModal, setBillingModal] = useState<{ companyId: string; companyName: string; salesAmount: number } | null>(null);
  const [billingSupply, setBillingSupply] = useState(0);
  const [billingTax, setBillingTax] = useState(0);
  const [billingNotes, setBillingNotes] = useState("");

  function changeMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return `${y}년 ${m}월`;
  }, [month]);

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [y, m] = month.split("-").map(Number);
    const from = `${month}-01`;
    const to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

    const [salesRes, stmtRes, billRes, compRes] = await Promise.all([
      db.from("inventory_logs").select("company_id, quantity, unit_price").eq("type", "out").gte("log_date", from).lte("log_date", to),
      db.from("statements").select("*").gte("statement_date", from).lte("statement_date", to).order("statement_date", { ascending: false }),
      db.from("billings").select("*, companies(*), payments(*)").eq("billing_month", month),
      db.from("companies").select("*").eq("is_active", true).order("name"),
    ]);

    const companies: Company[] = compRes.data || [];
    setAllCompanies(companies);

    // 판매 집계
    const salesMap = new Map<string, SalesData>();
    for (const log of salesRes.data || []) {
      if (!log.company_id) continue;
      const ex = salesMap.get(log.company_id) || { amount: 0, count: 0 };
      ex.amount += log.quantity * (log.unit_price || 0);
      ex.count += 1;
      salesMap.set(log.company_id, ex);
    }

    // 명세서 집계
    const stmtMap = new Map<string, Statement[]>();
    for (const s of stmtRes.data || []) {
      const arr = stmtMap.get(s.company_id) || [];
      arr.push(s);
      stmtMap.set(s.company_id, arr);
    }

    // 청구 집계
    const billMap = new Map<string, BillingWithPayments>();
    for (const b of billRes.data || []) {
      billMap.set(b.company_id, b);
    }

    // 이번 달 활동이 있는 거래처만
    const activeIds = new Set([...salesMap.keys(), ...stmtMap.keys(), ...billMap.keys()]);

    const rows: CompanyRow[] = companies
      .filter((c) => activeIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        sales: salesMap.get(c.id) || { amount: 0, count: 0 },
        statements: stmtMap.get(c.id) || [],
        billing: billMap.get(c.id) || null,
      }))
      .sort((a, b) => b.sales.amount - a.sales.amount);

    setCompanyRows(rows);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // 요약
  const summary = useMemo(() => {
    let totalSales = 0;
    let stmtIssued = 0;
    let taxUnissued = 0;
    let totalUnpaid = 0;
    for (const r of companyRows) {
      totalSales += r.sales.amount;
      if (r.statements.length > 0) stmtIssued++;
      if (r.billing && !r.billing.tax_invoice_issued) taxUnissued++;
      if (r.billing) totalUnpaid += Math.max(0, r.billing.total_amount - r.billing.paid_amount);
    }
    return { totalSales, stmtIssued, taxUnissued, totalUnpaid };
  }, [companyRows]);

  // 세금계산서 발행 처리
  async function handleTaxInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!taxModal) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    await db.from("billings").update({
      tax_invoice_issued: true,
      tax_invoice_date: taxDate,
      tax_invoice_number: taxNumber || null,
    }).eq("id", taxModal.id);
    setTaxModal(null);
    setTaxNumber("");
    fetchData();
  }

  // 입금 처리
  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModal || payAmount <= 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    await db.from("payments").insert({
      billing_id: payModal.id,
      amount: payAmount,
      payment_date: payDate,
      payment_method: payMethod,
      notes: payNotes || null,
    });
    const newPaid = payModal.paid_amount + payAmount;
    const newStatus = newPaid >= payModal.total_amount ? "paid" : "partial";
    await db.from("billings").update({
      paid_amount: newPaid,
      status: newStatus,
      paid_date: newStatus === "paid" ? payDate : null,
    }).eq("id", payModal.id);
    setPayModal(null);
    setPayAmount(0);
    setPayNotes("");
    fetchData();
  }

  // 청구 생성
  async function handleCreateBilling(e: React.FormEvent) {
    e.preventDefault();
    if (!billingModal) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const total = billingSupply + billingTax;
    await db.from("billings").insert({
      billing_number: generateBillingNumber(month),
      company_id: billingModal.companyId,
      billing_month: month,
      total_supply: billingSupply,
      total_tax: billingTax,
      total_amount: total,
      notes: billingNotes || null,
    });
    setBillingModal(null);
    setBillingSupply(0);
    setBillingTax(0);
    setBillingNotes("");
    fetchData();
  }

  function openBillingModal(row: CompanyRow) {
    const supply = row.sales.amount;
    const tax = Math.round(supply * 0.1);
    setBillingModal({ companyId: row.id, companyName: row.name, salesAmount: row.sales.amount });
    setBillingSupply(supply);
    setBillingTax(tax);
    setBillingNotes("");
  }

  // 단계 상태 아이콘
  function StepIcon({ done }: { done: boolean }) {
    return done
      ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
      : <Circle size={16} className="text-text-muted/40 shrink-0" />;
  }

  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const stmtFrom = `${month}-01`;
  const stmtTo = `${month}-${String(lastDay).padStart(2, "0")}`;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">정산 관리</h1>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-bg-card">
          <button type="button" onClick={() => changeMonth(-1)} className="p-2.5 text-text-muted hover:text-text-primary transition-colors" title="전월">
            <ChevronLeft size={18} />
          </button>
          <span className="px-3 py-2 text-sm font-semibold text-text-primary min-w-[100px] text-center">{monthLabel}</span>
          <button type="button" onClick={() => changeMonth(1)} className="p-2.5 text-text-muted hover:text-text-primary transition-colors" title="다음월">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">총 판매액</p>
          <p className="text-xl font-bold text-text-primary">{formatNumber(summary.totalSales)}원</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">명세서 발행</p>
          <p className="text-xl font-bold text-emerald-400">{summary.stmtIssued}개사</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">세금계산서 미발행</p>
          <p className={`text-xl font-bold ${summary.taxUnissued > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {summary.taxUnissued}건
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">미수금</p>
          <p className={`text-xl font-bold ${summary.totalUnpaid > 0 ? "text-red-400" : "text-text-primary"}`}>
            {formatNumber(summary.totalUnpaid)}원
          </p>
        </div>
      </div>

      {/* 거래처별 카드 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : companyRows.length === 0 ? (
        <div className="text-center py-20">
          <Receipt size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">{monthLabel} 판매·정산 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {companyRows.map((row) => {
            const billing = row.billing;
            const unpaid = billing ? Math.max(0, billing.total_amount - billing.paid_amount) : 0;
            const paidPct = billing && billing.total_amount > 0
              ? Math.round((billing.paid_amount / billing.total_amount) * 100)
              : 0;

            return (
              <div key={row.id} className="rounded-2xl border border-border bg-bg-card overflow-hidden">
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-dark/40">
                  <h3 className="text-base font-bold text-text-primary">{row.name}</h3>
                  <span className="text-sm font-bold text-accent">{formatNumber(row.sales.amount)}원</span>
                </div>

                {/* 4단계 흐름 */}
                <div className="grid sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">

                  {/* ① 판매 현황 */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon done={row.sales.count > 0} />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">① 판매</span>
                    </div>
                    {row.sales.count > 0 ? (
                      <>
                        <p className="text-base font-bold text-text-primary">{formatNumber(row.sales.amount)}원</p>
                        <p className="text-xs text-text-muted mt-0.5">{row.sales.count}건</p>
                      </>
                    ) : (
                      <p className="text-xs text-text-muted">판매 없음</p>
                    )}
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/sales`)}
                      className="mt-2 text-[11px] text-primary/70 hover:text-primary underline"
                    >
                      판매 상세 보기
                    </button>
                  </div>

                  {/* ② 거래명세서 */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon done={row.statements.length > 0} />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">② 명세서</span>
                    </div>
                    {row.statements.length > 0 ? (
                      <div className="space-y-1">
                        {row.statements.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <span className="text-xs text-emerald-400">{s.statement_number}</span>
                            <button
                              type="button"
                              onClick={() => router.push(`/admin/statements/${s.id}`)}
                              className="inline-flex items-center gap-0.5 text-[11px] text-text-muted hover:text-primary transition-colors"
                            >
                              <ExternalLink size={10} /> PDF
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/statements/new?salesCompanyId=${row.id}&salesFrom=${stmtFrom}&salesTo=${stmtTo}`)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary"
                        >
                          <Plus size={10} /> 추가 발행
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-text-muted mb-2">미발행</p>
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/statements/new?salesCompanyId=${row.id}&salesFrom=${stmtFrom}&salesTo=${stmtTo}`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          <FileText size={12} /> 명세서 발행
                        </button>
                      </>
                    )}
                  </div>

                  {/* ③ 세금계산서 */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon done={!!billing?.tax_invoice_issued} />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">③ 세금계산서</span>
                    </div>
                    {billing?.tax_invoice_issued ? (
                      <div>
                        <p className="text-xs text-emerald-400 font-medium">발행완료</p>
                        {billing.tax_invoice_date && (
                          <p className="text-[11px] text-text-muted">{billing.tax_invoice_date}</p>
                        )}
                        {billing.tax_invoice_number && (
                          <p className="text-[11px] text-text-muted font-mono">{billing.tax_invoice_number}</p>
                        )}
                      </div>
                    ) : billing ? (
                      <>
                        <p className="text-xs text-text-muted mb-2">미발행</p>
                        <button
                          type="button"
                          onClick={() => { setTaxModal(billing); setTaxDate(new Date().toISOString().slice(0, 10)); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
                        >
                          <Receipt size={12} /> 발행 처리
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-text-muted">청구 후 가능</p>
                    )}
                  </div>

                  {/* ④ 수금 */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon done={!!billing && unpaid === 0} />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">④ 수금</span>
                    </div>
                    {billing ? (
                      <>
                        <div className="space-y-0.5 mb-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-text-muted">청구액</span>
                            <span className="text-text-primary">{formatNumber(billing.total_amount)}원</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-text-muted">입금액</span>
                            <span className="text-emerald-400">{formatNumber(billing.paid_amount)}원</span>
                          </div>
                          {unpaid > 0 && (
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-text-muted">미수금</span>
                              <span className="text-red-400">{formatNumber(unpaid)}원</span>
                            </div>
                          )}
                        </div>
                        {/* 수금 progress bar */}
                        <div className="h-1.5 rounded-full bg-bg-dark overflow-hidden mb-2">
                          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${paidPct}%` }} aria-label={`수금률 ${paidPct}%`} />
                        </div>
                        {unpaid > 0 && (
                          <button
                            type="button"
                            onClick={() => { setPayModal(billing); setPayAmount(unpaid); setPayDate(new Date().toISOString().slice(0, 10)); setPayNotes(""); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                          >
                            <CreditCard size={12} /> 입금 처리
                          </button>
                        )}
                        {/* 입금 이력 */}
                        {billing.payments.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {billing.payments.map((p: Payment) => (
                              <div key={p.id} className="flex justify-between text-[10px] text-text-muted">
                                <span>{p.payment_date}</span>
                                <span className="text-emerald-400">+{formatNumber(p.amount)}원</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-text-muted mb-2">청구 없음</p>
                        <button
                          type="button"
                          onClick={() => openBillingModal(row)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                        >
                          <Plus size={12} /> 청구 생성
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 세금계산서 발행 모달 */}
      {taxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">세금계산서 발행 처리</h2>
              <button type="button" onClick={() => setTaxModal(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleTaxInvoice} className="p-6 space-y-4">
              <p className="text-sm text-text-secondary">
                {taxModal.companies?.name} — {formatNumber(taxModal.total_amount)}원
              </p>
              <div>
                <label className="block text-sm text-text-secondary mb-1">발행일 <span className="text-red-400">*</span></label>
                <input type="date" value={taxDate} onChange={(e) => setTaxDate(e.target.value)} required
                  aria-label="세금계산서 발행일"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">승인번호 (선택)</label>
                <input type="text" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)}
                  placeholder="국세청 승인번호" aria-label="국세청 승인번호"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setTaxModal(null)} className="px-5 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-yellow-500 text-bg-dark font-semibold hover:bg-yellow-400 transition-colors">발행 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 입금 처리 모달 */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">입금 처리 — {payModal.companies?.name}</h2>
              <button type="button" onClick={() => setPayModal(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handlePayment} className="p-6 space-y-4">
              <p className="text-sm text-text-secondary">
                미수금 <span className="text-red-400 font-bold">{formatNumber(payModal.total_amount - payModal.paid_amount)}원</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금액 <span className="text-red-400">*</span></label>
                  <input type="number" min={1} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} required
                    aria-label="입금액"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금일</label>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                    aria-label="입금일"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금방법</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                    aria-label="입금방법"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary">
                    <option value="bank_transfer">계좌이체</option>
                    <option value="cash">현금</option>
                    <option value="card">카드</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">메모</label>
                  <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                    aria-label="입금 메모" placeholder="메모"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setPayModal(null)} className="px-5 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors">입금 확인</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 청구 생성 모달 */}
      {billingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">청구 생성 — {billingModal.companyName}</h2>
              <button type="button" onClick={() => setBillingModal(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateBilling} className="p-6 space-y-4">
              <p className="text-xs text-text-muted">
                판매 데이터 기준 자동 계산됨 (수정 가능)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">공급가액</label>
                  <input type="number" min={0} value={billingSupply}
                    aria-label="공급가액"
                    onChange={(e) => { setBillingSupply(Number(e.target.value)); setBillingTax(Math.round(Number(e.target.value) * 0.1)); }}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">세액 (10%)</label>
                  <input type="number" min={0} value={billingTax}
                    aria-label="세액"
                    onChange={(e) => setBillingTax(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="rounded-xl bg-bg-dark border border-border p-3 flex justify-between items-center">
                <span className="text-sm text-text-muted">합계</span>
                <span className="text-lg font-bold text-accent">{formatNumber(billingSupply + billingTax)}원</span>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">메모</label>
                <input type="text" value={billingNotes} onChange={(e) => setBillingNotes(e.target.value)}
                  aria-label="청구 메모" placeholder="메모"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setBillingModal(null)} className="px-5 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors">청구 생성</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
