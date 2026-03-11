"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BillingWithPayments, Company } from "@/lib/supabase/types";
import { BILLING_STATUS, formatNumber, generateBillingNumber } from "@/lib/utils";
import { Plus, Receipt, CreditCard, X } from "lucide-react";

export default function BillingPage() {
  const supabase = createClient();

  const [billings, setBillings] = useState<BillingWithPayments[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState(
    new Date().toISOString().slice(0, 7),
  );

  // 생성 모달
  const [showCreate, setShowCreate] = useState(false);
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newSupply, setNewSupply] = useState(0);
  const [newTax, setNewTax] = useState(0);
  const [newNotes, setNewNotes] = useState("");

  // 입금 모달
  const [paymentTarget, setPaymentTarget] = useState<BillingWithPayments | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payNotes, setPayNotes] = useState("");

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [bRes, cRes] = await Promise.all([
      db.from("billings").select("*, companies(*), payments(*)").eq("billing_month", monthFilter).order("created_at", { ascending: false }),
      db.from("companies").select("*").eq("is_active", true).order("name"),
    ]);
    setBillings((bRes.data as BillingWithPayments[]) || []);
    setCompanies(cRes.data || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [monthFilter]);

  // 요약
  const totalBilled = billings.reduce((s, b) => s + b.total_amount, 0);
  const totalPaid = billings.reduce((s, b) => s + b.paid_amount, 0);
  const totalUnpaid = totalBilled - totalPaid;

  async function handleCreateBilling(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompanyId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const total = newSupply + newTax;
    await db.from("billings").insert({
      billing_number: generateBillingNumber(monthFilter),
      company_id: newCompanyId,
      billing_month: monthFilter,
      total_supply: newSupply,
      total_tax: newTax,
      total_amount: total,
      notes: newNotes || null,
    });
    setShowCreate(false);
    setNewCompanyId("");
    setNewSupply(0);
    setNewTax(0);
    setNewNotes("");
    fetchData();
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentTarget || payAmount <= 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    await db.from("payments").insert({
      billing_id: paymentTarget.id,
      amount: payAmount,
      payment_date: payDate,
      payment_method: payMethod,
      notes: payNotes || null,
    });

    const newPaidAmount = paymentTarget.paid_amount + payAmount;
    const newStatus = newPaidAmount >= paymentTarget.total_amount ? "paid" : "partial";
    await db.from("billings").update({
      paid_amount: newPaidAmount,
      status: newStatus,
      paid_date: newStatus === "paid" ? payDate : null,
    }).eq("id", paymentTarget.id);

    setPaymentTarget(null);
    setPayAmount(0);
    setPayNotes("");
    fetchData();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">월 정산/청구</h1>
        <div className="flex gap-3">
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-border bg-bg-card text-text-primary focus:outline-none focus:border-primary transition-colors"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
          >
            <Plus size={18} /> 새 청구
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-sm text-text-muted mb-1">총 청구액</p>
          <p className="text-2xl font-bold text-text-primary">{formatNumber(totalBilled)}원</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-sm text-text-muted mb-1">입금액</p>
          <p className="text-2xl font-bold text-emerald-400">{formatNumber(totalPaid)}원</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-sm text-text-muted mb-1">미수금</p>
          <p className={`text-2xl font-bold ${totalUnpaid > 0 ? "text-red-400" : "text-text-primary"}`}>
            {formatNumber(totalUnpaid)}원
          </p>
        </div>
      </div>

      {/* 청구 목록 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : billings.length === 0 ? (
        <div className="text-center py-20">
          <Receipt size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">{monthFilter}월 청구 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {billings.map((b) => {
            const st = BILLING_STATUS[b.status] || BILLING_STATUS.unpaid;
            const unpaid = b.total_amount - b.paid_amount;
            const paidPct = b.total_amount > 0 ? Math.round((b.paid_amount / b.total_amount) * 100) : 0;

            return (
              <div key={b.id} className="rounded-2xl border border-border bg-bg-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-text-primary">{b.companies.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-text-muted font-mono mt-1">{b.billing_number}</p>
                  </div>
                  {b.status !== "paid" && (
                    <button
                      onClick={() => { setPaymentTarget(b); setPayAmount(unpaid); }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-400/10 text-emerald-400 text-sm font-medium hover:bg-emerald-400/20 transition-colors"
                    >
                      <CreditCard size={16} /> 입금 처리
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                  <div><p className="text-text-muted text-xs">공급가액</p><p className="text-text-primary font-medium">{formatNumber(b.total_supply)}원</p></div>
                  <div><p className="text-text-muted text-xs">세액</p><p className="text-text-primary font-medium">{formatNumber(b.total_tax)}원</p></div>
                  <div><p className="text-text-muted text-xs">청구액</p><p className="text-text-primary font-bold">{formatNumber(b.total_amount)}원</p></div>
                  <div><p className="text-text-muted text-xs">미수금</p><p className={`font-bold ${unpaid > 0 ? "text-red-400" : "text-emerald-400"}`}>{formatNumber(unpaid)}원</p></div>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full bg-bg-dark overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${paidPct}%` }} />
                </div>

                {/* 입금 이력 */}
                {b.payments.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs text-text-muted mb-2">입금 이력</p>
                    <div className="space-y-1">
                      {b.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-text-secondary">
                            {new Date(p.payment_date).toLocaleDateString("ko-KR")}
                            {p.payment_method === "bank_transfer" && " (계좌이체)"}
                            {p.payment_method === "cash" && " (현금)"}
                            {p.payment_method === "card" && " (카드)"}
                          </span>
                          <span className="text-emerald-400 font-medium">+{formatNumber(p.amount)}원</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 청구 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">새 청구 ({monthFilter})</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateBilling} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">거래처 <span className="text-red-400">*</span></label>
                  <select value={newCompanyId} onChange={(e) => setNewCompanyId(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary">
                    <option value="">선택</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">메모</label>
                  <input type="text" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">공급가액</label>
                  <input type="number" min={0} value={newSupply} onChange={(e) => { setNewSupply(Number(e.target.value)); setNewTax(Math.round(Number(e.target.value) * 0.1)); }} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">세액</label>
                  <input type="number" min={0} value={newTax} onChange={(e) => setNewTax(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="text-right text-lg font-bold text-text-primary">합계: {formatNumber(newSupply + newTax)}원</div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors">생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 입금 모달 */}
      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">입금 처리 — {paymentTarget.companies.name}</h2>
              <button onClick={() => setPaymentTarget(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handlePayment} className="p-6 space-y-4">
              <div className="text-sm text-text-secondary">
                미수금: <span className="text-red-400 font-bold">{formatNumber(paymentTarget.total_amount - paymentTarget.paid_amount)}원</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금액 <span className="text-red-400">*</span></label>
                  <input type="number" min={1} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} required className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금일</label>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">입금방법</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary">
                    <option value="bank_transfer">계좌이체</option>
                    <option value="cash">현금</option>
                    <option value="card">카드</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">메모</label>
                  <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setPaymentTarget(null)} className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors">입금 확인</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
