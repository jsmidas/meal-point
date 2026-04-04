"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company, Statement, BillingWithPayments, Payment } from "@/lib/supabase/types";
import { formatNumber, generateBillingNumber } from "@/lib/utils";
import { dbInsert, dbUpdate } from "@/lib/db";
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
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";

type SalesLog = { id: string; company_id: string; quantity: number; unit_price: number; log_date: string; reason: string | null; product_id: string | null; products: { name: string; unit: string } | null };
type SalesData = { amount: number; count: number; logs: SalesLog[] };

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

  // 세금계산서 모달 (CompanyRow 기반으로 변경)
  const [taxModal, setTaxModal] = useState<CompanyRow | null>(null);
  const [taxDate, setTaxDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxNumber, setTaxNumber] = useState("");
  const [taxChecked, setTaxChecked] = useState<Set<string>>(new Set()); // 선택된 명세서 ID
  const [taxSupplyOverride, setTaxSupplyOverride] = useState<number | null>(null); // 수동 금액 입력

  // 입금 모달 (CompanyRow 기반으로 변경 - 청구 없어도 가능)
  const [payModalRow, setPayModalRow] = useState<CompanyRow | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payNotes, setPayNotes] = useState("");

  // 판매 상세 모달
  const [salesDetailModal, setSalesDetailModal] = useState<{ companyName: string; logs: SalesLog[]; statements: Statement[]; billing: BillingWithPayments | null } | null>(null);

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

    const [salesRes, stmtRes, billRes, compRes, confirmRes] = await Promise.all([
      db.from("inventory_logs").select("id, company_id, quantity, unit_price, log_date, reason, product_id, products(name, unit)").eq("type", "out").gte("log_date", from).lte("log_date", to).order("log_date"),
      db.from("statements").select("*").gte("statement_date", from).lte("statement_date", to).order("statement_date", { ascending: false }),
      db.from("billings").select("*, companies(*), payments(*)").eq("billing_month", month),
      db.from("companies").select("*").eq("is_active", true).order("name"),
      db.from("sale_checks").select("company_id, sale_date").gte("sale_date", from).lte("sale_date", to),
    ]);

    const companies: Company[] = compRes.data || [];
    setAllCompanies(companies);

    // 판매관리에서 체크된 거래처 Set
    const confirmedCompanyIds = new Set<string>();
    for (const c of confirmRes.data || []) {
      if (c.company_id) confirmedCompanyIds.add(c.company_id);
    }

    // 판매 집계 (체크된 거래처만)
    const salesMap = new Map<string, SalesData>();
    for (const log of salesRes.data || []) {
      if (!log.company_id) continue;
      if (!confirmedCompanyIds.has(log.company_id)) continue;
      const ex = salesMap.get(log.company_id) || { amount: 0, count: 0, logs: [] as SalesLog[] };
      ex.amount += log.quantity * (log.unit_price || 0);
      ex.count += 1;
      ex.logs.push(log);
      salesMap.set(log.company_id, ex);
    }

    // 명세서 집계 (체크된 거래처만)
    const stmtMap = new Map<string, Statement[]>();
    for (const s of stmtRes.data || []) {
      if (!confirmedCompanyIds.has(s.company_id)) continue;
      const arr = stmtMap.get(s.company_id) || [];
      arr.push(s);
      stmtMap.set(s.company_id, arr);
    }

    // 청구 집계 + 명세서 기준 자동 동기화
    const billMap = new Map<string, BillingWithPayments>();
    for (const b of billRes.data || []) {
      billMap.set(b.company_id, b);

      // 명세서가 있으면 명세서 합산으로 청구 금액 자동 보정
      const stmts = stmtMap.get(b.company_id);
      if (stmts && stmts.length > 0) {
        const stmtSupply = stmts.reduce((s, st) => s + st.supply_amount, 0);
        const stmtTax = Math.round(stmtSupply * 0.1);
        const stmtTotal = stmtSupply + stmtTax;
        if (b.total_amount !== stmtTotal) {
          // DB 업데이트 (비동기, UI 먼저 반영)
          dbUpdate("billings", {
            total_supply: stmtSupply,
            total_tax: stmtTax,
            total_amount: stmtTotal,
          }, { id: b.id });
          // 로컬 데이터 즉시 반영
          b.total_supply = stmtSupply;
          b.total_tax = stmtTax;
          b.total_amount = stmtTotal;
        }
      }
    }

    // 체크된 거래처 중 활동이 있는 거래처만
    const activeIds = new Set([...salesMap.keys(), ...stmtMap.keys()]);
    // 청구가 있는 거래처도 포함 (이미 진행 중인 정산)
    for (const key of billMap.keys()) {
      if (confirmedCompanyIds.has(key)) activeIds.add(key);
    }

    const rows: CompanyRow[] = companies
      .filter((c) => activeIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        sales: salesMap.get(c.id) || { amount: 0, count: 0, logs: [] },
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

  // 세금계산서 합산금액 계산 (판매액 기준 동기화)
  const taxComputedSupply = useMemo(() => {
    if (!taxModal) return 0;
    if (taxSupplyOverride !== null) return taxSupplyOverride;
    // 명세서 체크된 경우: 선택된 명세서 합산
    if (taxChecked.size > 0) {
      return taxModal.statements
        .filter((s) => taxChecked.has(s.id))
        .reduce((sum, s) => sum + s.supply_amount, 0);
    }
    // 기본: 판매금액 우선 (판매 데이터가 있으면 판매액, 없으면 기존 청구금액)
    return taxModal.sales.amount || taxModal.billing?.total_supply || 0;
  }, [taxModal, taxChecked, taxSupplyOverride]);

  const taxComputedTax = Math.round(taxComputedSupply * 0.1);
  const taxComputedTotal = taxComputedSupply + taxComputedTax;

  function openTaxModal(row: CompanyRow) {
    setTaxModal(row);
    setTaxDate(new Date().toISOString().slice(0, 10));
    setTaxNumber("");
    setTaxSupplyOverride(null);
    // 명세서 선택 해제 → 판매액 기준으로 시작 (명세서와 판매액이 다를 수 있으므로)
    setTaxChecked(new Set());
  }

  // 세금계산서 발행 처리
  async function handleTaxInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!taxModal) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    let billingId = taxModal.billing?.id;

    // 청구 없으면 자동 생성
    if (!billingId) {
      const { data: newBillingData } = await dbInsert("billings", {
        billing_number: generateBillingNumber(month),
        company_id: taxModal.id,
        billing_month: month,
        total_supply: taxComputedSupply,
        total_tax: taxComputedTax,
        total_amount: taxComputedTotal,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newBilling = (Array.isArray(newBillingData) ? newBillingData[0] : newBillingData) as any;
      billingId = newBilling?.id;
    } else {
      // 기존 청구 금액 업데이트
      await dbUpdate("billings", {
        total_supply: taxComputedSupply,
        total_tax: taxComputedTax,
        total_amount: taxComputedTotal,
      }, { id: billingId });
    }

    await dbUpdate("billings", {
      tax_invoice_issued: true,
      tax_invoice_date: taxDate,
      tax_invoice_number: taxNumber || null,
    }, { id: billingId! });

    setTaxModal(null);
    setTaxNumber("");
    fetchData();
  }

  // 입금 처리 (청구 없어도 자동 생성)
  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModalRow || payAmount <= 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    let billingId = payModalRow.billing?.id;
    let currentPaid = payModalRow.billing?.paid_amount ?? 0;
    let currentTotal = payModalRow.billing?.total_amount ?? payAmount;

    // 청구 없으면 자동 생성
    if (!billingId) {
      const supply = payModalRow.sales.amount || payAmount;
      const tax = Math.round(supply * 0.1);
      const { data: newBillingData } = await dbInsert("billings", {
        billing_number: generateBillingNumber(month),
        company_id: payModalRow.id,
        billing_month: month,
        total_supply: supply,
        total_tax: tax,
        total_amount: supply + tax,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newBilling = (Array.isArray(newBillingData) ? newBillingData[0] : newBillingData) as any;
      billingId = newBilling?.id;
      currentTotal = supply + tax;
    }

    await dbInsert("payments", {
      billing_id: billingId,
      amount: payAmount,
      payment_date: payDate,
      payment_method: payMethod,
      notes: payNotes || null,
    });

    const newPaid = currentPaid + payAmount;
    const newStatus = newPaid >= currentTotal ? "paid" : "partial";
    await dbUpdate("billings", {
      paid_amount: newPaid,
      status: newStatus,
      paid_date: newStatus === "paid" ? payDate : null,
    }, { id: billingId });

    setPayModalRow(null);
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
    await dbInsert("billings", {
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text-primary">{row.name}</h3>
                    {billing && row.sales.amount > 0 && (row.sales.amount + Math.round(row.sales.amount * 0.1)) !== billing.total_amount && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 rounded-full px-2 py-0.5" title="판매액과 청구액이 일치하지 않습니다">
                        <AlertTriangle size={10} /> 금액 불일치
                      </span>
                    )}
                  </div>
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
                      onClick={() => setSalesDetailModal({ companyName: row.name, logs: row.sales.logs, statements: row.statements, billing: row.billing })}
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
                    ) : (
                      <>
                        <p className="text-xs text-text-muted mb-2">미발행</p>
                        <button
                          type="button"
                          onClick={() => openTaxModal(row)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
                        >
                          <Receipt size={12} /> 발행 처리
                        </button>
                      </>
                    )}
                  </div>

                  {/* ④ 수금 */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon done={!!billing && unpaid === 0 && billing.paid_amount > 0} />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">④ 수금</span>
                    </div>
                    {billing ? (
                      <div className="space-y-0.5 mb-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-muted">청구액</span>
                          <span className="text-text-primary">{formatNumber(billing.total_amount)}원</span>
                        </div>
                        {/* 판매액과 청구액 차이 경고 */}
                        {(() => {
                          const expectedBilling = row.sales.amount + Math.round(row.sales.amount * 0.1);
                          const diff = expectedBilling - billing.total_amount;
                          return diff !== 0 && row.sales.amount > 0 ? (
                            <div className="flex justify-between text-[10px] bg-yellow-500/10 rounded px-1.5 py-0.5 -mx-1.5">
                              <span className="text-yellow-400">판매 기준 {formatNumber(expectedBilling)}원</span>
                              <span className="text-yellow-400 font-bold">{diff > 0 ? "+" : ""}{formatNumber(diff)}원</span>
                            </div>
                          ) : null;
                        })()}
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
                    ) : (
                      <p className="text-xs text-text-muted mb-2">입금 내역 없음</p>
                    )}
                    {/* 수금 progress bar (청구 있을 때만) */}
                    {billing && (
                      <div className="h-1.5 rounded-full bg-bg-dark overflow-hidden mb-2">
                        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${paidPct}%` }} aria-label={`수금률 ${paidPct}%`} />
                      </div>
                    )}
                    {/* 입금 처리 버튼 - 항상 표시 */}
                    {(!billing || unpaid > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayModalRow(row);
                          setPayAmount(unpaid > 0 ? unpaid : row.sales.amount);
                          setPayDate(new Date().toISOString().slice(0, 10));
                          setPayNotes("");
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                      >
                        <CreditCard size={12} /> 입금 처리
                      </button>
                    )}
                    {/* 입금 이력 */}
                    {billing && billing.payments.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {billing.payments.map((p: Payment) => (
                          <div key={p.id} className="flex justify-between text-[10px] text-text-muted">
                            <span>{p.payment_date}</span>
                            <span className="text-emerald-400">+{formatNumber(p.amount)}원</span>
                          </div>
                        ))}
                      </div>
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
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg-card z-10">
              <h2 className="text-base font-bold text-text-primary">세금계산서 발행 — {taxModal.name}</h2>
              <button type="button" onClick={() => setTaxModal(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleTaxInvoice} className="p-6 space-y-5">

              {/* 판매액 기준 안내 */}
              {(() => {
                const stmtSupply = taxModal.statements.reduce((s, st) => s + st.supply_amount, 0);
                const salesAmount = taxModal.sales.amount;
                const diff = salesAmount - stmtSupply;
                return taxModal.statements.length > 0 && diff !== 0 ? (
                  <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3 text-xs space-y-1">
                    <p className="text-yellow-400 font-semibold">판매액과 명세서 금액 불일치</p>
                    <div className="flex justify-between"><span className="text-text-muted">판매액 (출고 기준)</span><span className="text-text-primary">{formatNumber(salesAmount)}원</span></div>
                    <div className="flex justify-between"><span className="text-text-muted">명세서 공급가 합계</span><span className="text-text-primary">{formatNumber(stmtSupply)}원</span></div>
                    <div className="flex justify-between font-bold"><span className="text-yellow-400">차이</span><span className="text-yellow-400">{diff > 0 ? "+" : ""}{formatNumber(diff)}원</span></div>
                    <p className="text-text-muted pt-1">기본값은 판매액 기준입니다. 명세서 기준으로 하려면 아래에서 명세서를 선택하세요.</p>
                  </div>
                ) : null;
              })()}

              {/* 명세서 합산 선택 */}
              {taxModal.statements.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-text-primary mb-2">포함할 명세서 선택</p>
                  <div className="space-y-1.5 rounded-xl border border-border bg-bg-dark p-3">
                    {taxModal.statements.map((s) => (
                      <label key={s.id} className="flex items-center justify-between gap-3 cursor-pointer hover:bg-bg-card-hover rounded-lg px-2 py-1.5 transition-colors">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={taxChecked.has(s.id)}
                            onChange={(e) => {
                              const next = new Set(taxChecked);
                              if (e.target.checked) next.add(s.id);
                              else next.delete(s.id);
                              setTaxChecked(next);
                              setTaxSupplyOverride(null);
                            }}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-xs text-text-secondary">{s.statement_number}</span>
                          <span className="text-[11px] text-text-muted">{s.statement_date}</span>
                        </div>
                        <span className="text-xs font-medium text-text-primary">{formatNumber(s.supply_amount)}원</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 발행 금액 */}
              <div className="rounded-xl border border-border bg-bg-dark p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">공급가액</span>
                  <span className="text-text-primary font-medium">{formatNumber(taxComputedSupply)}원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">세액 (10%)</span>
                  <span className="text-text-primary">{formatNumber(taxComputedTax)}원</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                  <span className="text-text-primary">합계</span>
                  <span className="text-accent">{formatNumber(taxComputedTotal)}원</span>
                </div>
                <div className="pt-1">
                  <label className="text-xs text-text-muted">금액 직접 수정</label>
                  <input
                    type="number" min={0}
                    value={taxSupplyOverride ?? taxComputedSupply}
                    onChange={(e) => setTaxSupplyOverride(Number(e.target.value))}
                    aria-label="공급가액 직접 입력"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={() => setTaxModal(null)} className="px-5 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-yellow-500 text-bg-dark font-semibold hover:bg-yellow-400 transition-colors">발행 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 입금 처리 모달 */}
      {payModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">입금 처리 — {payModalRow.name}</h2>
              <button type="button" onClick={() => setPayModalRow(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handlePayment} className="p-6 space-y-4">
              {payModalRow.billing ? (
                <p className="text-sm text-text-secondary">
                  미수금 <span className="text-red-400 font-bold">{formatNumber(payModalRow.billing.total_amount - payModalRow.billing.paid_amount)}원</span>
                </p>
              ) : (
                <p className="text-xs text-yellow-500 bg-yellow-500/10 rounded-lg px-3 py-2">
                  청구 내역이 없습니다. 입금 처리 시 판매 금액 기준으로 청구가 자동 생성됩니다.
                </p>
              )}
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
                <button type="button" onClick={() => setPayModalRow(null)} className="px-5 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
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

      {/* 판매 상세 모달 */}
      {salesDetailModal && (() => {
        const logs = salesDetailModal.logs;
        const supply = logs.reduce((s, l) => s + l.quantity * (l.unit_price || 0), 0);
        const tax = Math.round(supply * 0.1);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <h2 className="text-base font-bold text-text-primary">
                  판매 상세 — {salesDetailModal.companyName}
                  <span className="ml-2 text-sm font-normal text-text-muted">{logs.length}건</span>
                </h2>
                <button type="button" onClick={() => setSalesDetailModal(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-dark">
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-text-muted font-medium">날짜</th>
                      <th className="px-4 py-3 text-left text-text-muted font-medium">품목</th>
                      <th className="px-4 py-3 text-right text-text-muted font-medium">수량</th>
                      <th className="px-4 py-3 text-right text-text-muted font-medium">단가</th>
                      <th className="px-4 py-3 text-right text-text-muted font-medium">공급가</th>
                      <th className="px-4 py-3 text-right text-text-muted font-medium">부가세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const lineSupply = log.quantity * (log.unit_price || 0);
                      const lineTax = Math.round(lineSupply * 0.1);
                      return (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-bg-card-hover transition-colors">
                          <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">{log.log_date}</td>
                          <td className="px-4 py-3 text-text-primary">
                            {log.products?.name || log.reason || "(기타)"}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {formatNumber(log.quantity)}
                            <span className="text-text-muted text-xs ml-0.5">{log.products?.unit || ""}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary text-xs">{formatNumber(log.unit_price || 0)}</td>
                          <td className="px-4 py-3 text-right font-medium text-accent">{formatNumber(lineSupply)}원</td>
                          <td className="px-4 py-3 text-right text-text-muted text-xs">{formatNumber(lineTax)}원</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border px-6 py-4 shrink-0 bg-bg-dark/60 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">공급가 합계</span>
                  <span className="font-bold text-text-primary">{formatNumber(supply)}원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">부가세 (10%)</span>
                  <span className="text-text-primary">{formatNumber(tax)}원</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-1">
                  <span className="text-text-primary">합계</span>
                  <span className="text-accent">{formatNumber(supply + tax)}원</span>
                </div>

                {/* 명세서·청구 비교 */}
                {(() => {
                  const stmts = salesDetailModal.statements;
                  const billing = salesDetailModal.billing;
                  const stmtSupply = stmts.reduce((s, st) => s + st.supply_amount, 0);
                  const stmtTotal = stmts.reduce((s, st) => s + st.total_amount, 0);
                  const supplyDiff = supply - stmtSupply;
                  const billingTotal = billing?.total_amount ?? 0;
                  const expectedBilling = supply + tax;
                  const billingDiff = expectedBilling - billingTotal;
                  return (
                    <div className="border-t border-border pt-3 mt-3 space-y-2">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">명세서·청구 비교</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">명세서 공급가 합계 ({stmts.length}건)</span>
                        <span className={`font-medium ${supplyDiff !== 0 ? "text-yellow-400" : "text-emerald-400"}`}>{formatNumber(stmtSupply)}원</span>
                      </div>
                      {supplyDiff !== 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-yellow-400">판매-명세서 차이</span>
                          <span className="text-yellow-400 font-bold">{supplyDiff > 0 ? "+" : ""}{formatNumber(supplyDiff)}원</span>
                        </div>
                      )}
                      {billing ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-text-muted">청구액 (부가세 포함)</span>
                            <span className={`font-medium ${billingDiff !== 0 ? "text-yellow-400" : "text-emerald-400"}`}>{formatNumber(billingTotal)}원</span>
                          </div>
                          {billingDiff !== 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-red-400">판매 합계와 청구액 차이</span>
                              <span className="text-red-400 font-bold">{billingDiff > 0 ? "+" : ""}{formatNumber(billingDiff)}원</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-text-muted">청구 미생성</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
