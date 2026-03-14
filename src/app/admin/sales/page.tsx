"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product, Company, InventoryLog } from "@/lib/supabase/types";
import { formatNumber, formatDate } from "@/lib/utils";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowUpCircle,
  X,
  Trash2,
  Building2,
  ShoppingCart,
  Receipt,
} from "lucide-react";

type SalesLog = InventoryLog & { companies?: Company | null; products?: Product | null };

export default function SalesPage() {
  const supabase = createClient();

  const [logs, setLogs] = useState<SalesLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // 월 네비게이션
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // 판매 등록 모달
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    company_id: "",
    quantity: 1,
    unit_price: 0,
    log_date: new Date().toISOString().slice(0, 10),
    reason: "",
  });

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

    const [logRes, prodRes, compRes] = await Promise.all([
      db
        .from("inventory_logs")
        .select("*, companies(*), products(*)")
        .eq("type", "out")
        .order("log_date", { ascending: false })
        .limit(500),
      db.from("products").select("*").eq("is_active", true).order("name"),
      db.from("companies").select("*").eq("is_active", true).order("name"),
    ]);

    setLogs(logRes.data || []);
    setProducts(prodRes.data || []);
    setCompanies(compRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 해당 월 판매 로그
  const monthLogs = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);
    return logs.filter((l) => {
      const d = new Date(l.log_date || l.created_at);
      return d >= start && d <= end;
    });
  }, [logs, month]);

  // 월 합계
  const monthTotal = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    for (const log of monthLogs) {
      totalQty += log.quantity;
      totalAmount += log.quantity * (log.unit_price || 0);
    }
    return { totalQty, totalAmount };
  }, [monthLogs]);

  // 거래처별 판매 집계 (정산 기초)
  const customerSummary = useMemo(() => {
    const map = new Map<
      string,
      { name: string; qty: number; amount: number; count: number }
    >();
    for (const log of monthLogs) {
      const key = log.company_id || "__none__";
      const name = log.companies?.name || "(거래처 미지정)";
      const existing = map.get(key) || { name, qty: 0, amount: 0, count: 0 };
      existing.qty += log.quantity;
      existing.amount += log.quantity * (log.unit_price || 0);
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthLogs]);

  function resetForm() {
    setForm({
      product_id: "",
      company_id: "",
      quantity: 1,
      unit_price: 0,
      log_date: new Date().toISOString().slice(0, 10),
      reason: "",
    });
  }

  // 상품 선택 시 판매단가 자동 세팅
  function handleProductChange(productId: string) {
    const product = products.find((p) => p.id === productId);
    setForm({
      ...form,
      product_id: productId,
      unit_price: product?.selling_price || 0,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product_id || form.quantity <= 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // 판매(출고) 로그
    await db.from("inventory_logs").insert({
      product_id: form.product_id,
      type: "out",
      quantity: form.quantity,
      reason: form.reason || null,
      company_id: form.company_id || null,
      unit_price: form.unit_price || 0,
      log_date: form.log_date,
    });

    // 재고 차감
    const { data: inv } = await db
      .from("inventory")
      .select("*")
      .eq("product_id", form.product_id)
      .maybeSingle();

    const newStock = Math.max(0, (inv?.current_stock || 0) - form.quantity);

    if (inv) {
      await db
        .from("inventory")
        .update({ current_stock: newStock, last_out_date: form.log_date })
        .eq("product_id", form.product_id);
    } else {
      await db.from("inventory").insert({
        product_id: form.product_id,
        current_stock: 0,
        last_out_date: form.log_date,
      });
    }

    setShowModal(false);
    resetForm();
    fetchData();
  }

  async function handleDelete(log: SalesLog) {
    if (
      !confirm(
        `이 판매 기록을 삭제하시겠습니까?\n${log.products?.name || ""} ${formatNumber(log.quantity)}개`
      )
    )
      return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // 재고 복원
    const { data: inv } = await db
      .from("inventory")
      .select("*")
      .eq("product_id", log.product_id)
      .maybeSingle();

    if (inv) {
      await db
        .from("inventory")
        .update({ current_stock: inv.current_stock + log.quantity })
        .eq("product_id", log.product_id);
    }

    await db.from("inventory_logs").delete().eq("id", log.id);
    fetchData();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">판매 관리</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> 판매 등록
        </button>
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={() => changeMonth(-1)}
          title="이전 월"
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-bold text-text-primary min-w-[120px] text-center">
          {monthLabel}
        </span>
        <button
          onClick={() => changeMonth(1)}
          title="다음 월"
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={16} className="text-primary" />
            <p className="text-sm text-text-muted">판매 건수</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{monthLogs.length}건</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle size={16} className="text-red-400" />
            <p className="text-sm text-text-muted">판매 수량</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {formatNumber(monthTotal.totalQty)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={16} className="text-accent" />
            <p className="text-sm text-text-muted">판매 금액</p>
          </div>
          <p className="text-2xl font-bold text-accent">
            {formatNumber(monthTotal.totalAmount)}원
          </p>
        </div>
      </div>

      {/* 거래처별 판매 집계 (정산 기초) */}
      {customerSummary.length > 0 && (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">
              거래처별 판매 집계
              <span className="text-sm text-text-muted font-normal ml-2">
                (정산/청구 기초 데이터)
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="px-4 py-3 text-left text-text-muted font-medium">거래처</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">건수</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">수량</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">판매 금액</th>
                </tr>
              </thead>
              <tbody>
                {customerSummary.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border hover:bg-bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 text-text-primary font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{s.count}건</td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatNumber(s.qty)}
                    </td>
                    <td className="px-4 py-3 text-right text-accent font-bold">
                      {formatNumber(s.amount)}원
                    </td>
                  </tr>
                ))}
                <tr className="bg-bg-dark font-bold">
                  <td className="px-4 py-3 text-text-primary">합계</td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {monthLogs.length}건
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {formatNumber(monthTotal.totalQty)}
                  </td>
                  <td className="px-4 py-3 text-right text-accent">
                    {formatNumber(monthTotal.totalAmount)}원
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 판매 내역 테이블 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : monthLogs.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingCart size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">
            {monthLabel}에 등록된 판매 내역이 없습니다.
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm"
          >
            <Plus size={18} /> 판매 등록
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">
              {monthLabel} 판매 내역
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="px-4 py-3 text-left text-text-muted font-medium">판매일</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">상품</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">거래처</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">수량</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">단가</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">금액</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">비고</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">삭제</th>
                </tr>
              </thead>
              <tbody>
                {monthLogs.map((log) => {
                  const amount = (log.unit_price || 0) * log.quantity;
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-bg-card-hover transition-colors"
                    >
                      <td className="px-4 py-3 text-text-secondary text-xs">
                        {formatDate(log.log_date || log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-text-primary font-medium">
                        {log.products?.name || log.product_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {log.companies?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-red-400 font-bold">
                        {formatNumber(log.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {log.unit_price > 0 ? formatNumber(log.unit_price) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {amount > 0 ? `${formatNumber(amount)}원` : "-"}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">{log.reason || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(log)}
                          title="삭제"
                          className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 판매 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary">판매 등록</h2>
              <button
                onClick={() => setShowModal(false)}
                title="닫기"
                className="text-text-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  상품 <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required
                  aria-label="판매 상품 선택"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">상품 선택</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  거래처 <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                  required
                  aria-label="거래처 선택"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">거래처 선택</option>
                  {companies.filter((c) => {
                    const ct = (c as any).company_type || "customer";
                    return ct === "customer" || ct === "both";
                  }).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    수량 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                    required
                    aria-label="수량"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">판매 단가 (원)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
                    aria-label="판매 단가"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              {form.quantity > 0 && form.unit_price > 0 && (
                <div className="px-4 py-3 rounded-xl bg-bg-dark border border-border">
                  <span className="text-sm text-text-muted">판매 금액: </span>
                  <span className="text-sm font-bold text-accent">
                    {formatNumber(form.quantity * form.unit_price)}원
                  </span>
                </div>
              )}
              <div>
                <label className="block text-sm text-text-secondary mb-1">판매일</label>
                <input
                  type="date"
                  value={form.log_date}
                  onChange={(e) => setForm({ ...form, log_date: e.target.value })}
                  aria-label="판매일"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">비고</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="예: 정기 납품, 추가 주문"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors"
                >
                  판매 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
