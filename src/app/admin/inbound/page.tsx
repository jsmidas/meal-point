"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product, Company, InventoryLog } from "@/lib/supabase/types";
import { formatNumber, formatDate } from "@/lib/utils";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
  X,
  Trash2,
  Building2,
  Package,
} from "lucide-react";

type InboundLog = InventoryLog & { companies?: Company | null; products?: Product | null };

export default function InboundPage() {
  const supabase = createClient();

  const [logs, setLogs] = useState<InboundLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // 월 네비게이션
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // 매입처 필터
  const [filterCompanyId, setFilterCompanyId] = useState<string>("all");

  // 입고 등록 모달
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
        .eq("type", "in")
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

  // 매입처만 필터 (supplier 또는 both)
  const suppliers = useMemo(() => {
    return companies.filter((c) => {
      const ct = (c as any).company_type || "customer";
      return ct === "supplier" || ct === "both";
    });
  }, [companies]);

  // 해당 월 입고 로그 필터
  const monthLogs = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);
    return logs.filter((l) => {
      const d = new Date(l.log_date || l.created_at);
      return d >= start && d <= end;
    });
  }, [logs, month]);

  // 매입처 필터 적용된 로그
  const filteredLogs = useMemo(() => {
    if (filterCompanyId === "all") return monthLogs;
    return monthLogs.filter((l) => l.company_id === filterCompanyId);
  }, [monthLogs, filterCompanyId]);

  // 월 합계
  const monthTotal = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    for (const log of filteredLogs) {
      totalQty += log.quantity;
      totalAmount += log.quantity * (log.unit_price || 0);
    }
    return { totalQty, totalAmount };
  }, [filteredLogs]);

  // 매입처별 집계
  const supplierSummary = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; amount: number; count: number }>();
    for (const log of filteredLogs) {
      const key = log.company_id || "__none__";
      const name = log.companies?.name || "(매입처 미지정)";
      const existing = map.get(key) || { name, qty: 0, amount: 0, count: 0 };
      existing.qty += log.quantity;
      existing.amount += log.quantity * (log.unit_price || 0);
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredLogs]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product_id || form.quantity <= 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // 입고 로그
    await db.from("inventory_logs").insert({
      product_id: form.product_id,
      type: "in",
      quantity: form.quantity,
      reason: form.reason || null,
      company_id: form.company_id || null,
      unit_price: form.unit_price || 0,
      log_date: form.log_date,
    });

    // 재고 업데이트
    const { data: inv } = await db
      .from("inventory")
      .select("*")
      .eq("product_id", form.product_id)
      .maybeSingle();

    const newStock = (inv?.current_stock || 0) + form.quantity;

    if (inv) {
      await db
        .from("inventory")
        .update({ current_stock: newStock, last_in_date: form.log_date })
        .eq("product_id", form.product_id);
    } else {
      await db.from("inventory").insert({
        product_id: form.product_id,
        current_stock: newStock,
        last_in_date: form.log_date,
      });
    }

    setShowModal(false);
    resetForm();
    fetchData();
  }

  async function handleDelete(log: InboundLog) {
    if (!confirm(`이 입고 기록을 삭제하시겠습니까?\n${log.products?.name || ""} ${formatNumber(log.quantity)}개`))
      return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // 재고 차감
    const { data: inv } = await db
      .from("inventory")
      .select("*")
      .eq("product_id", log.product_id)
      .maybeSingle();

    if (inv) {
      const newStock = Math.max(0, inv.current_stock - log.quantity);
      await db
        .from("inventory")
        .update({ current_stock: newStock })
        .eq("product_id", log.product_id);
    }

    // 로그 삭제
    await db.from("inventory_logs").delete().eq("id", log.id);
    fetchData();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">입고 관리 (매입)</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors"
        >
          <Plus size={18} /> 입고 등록
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

      {/* 매입처 필터 */}
      {suppliers.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-sm text-text-muted">매입처:</span>
          <select
            value={filterCompanyId}
            onChange={(e) => setFilterCompanyId(e.target.value)}
            aria-label="매입처 필터"
            className="px-4 py-2 rounded-xl border border-border bg-bg-card text-text-primary text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">전체 매입처</option>
            {suppliers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {filterCompanyId !== "all" && (
            <button
              type="button"
              onClick={() => setFilterCompanyId("all")}
              className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded-lg hover:bg-bg-card transition-colors"
            >
              초기화
            </button>
          )}
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle size={16} className="text-emerald-400" />
            <p className="text-sm text-text-muted">입고 건수</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{filteredLogs.length}건</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Package size={16} className="text-primary" />
            <p className="text-sm text-text-muted">입고 수량</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {formatNumber(monthTotal.totalQty)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-accent" />
            <p className="text-sm text-text-muted">매입 금액</p>
          </div>
          <p className="text-2xl font-bold text-accent">
            {formatNumber(monthTotal.totalAmount)}원
          </p>
        </div>
      </div>

      {/* 매입처별 집계 */}
      {supplierSummary.length > 0 && (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">매입처별 집계</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="px-4 py-3 text-left text-text-muted font-medium">매입처</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">건수</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">수량</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">매입 금액</th>
                </tr>
              </thead>
              <tbody>
                {supplierSummary.map((s) => (
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
                {/* 합계 행 */}
                <tr className="bg-bg-dark font-bold">
                  <td className="px-4 py-3 text-text-primary">합계</td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {filteredLogs.length}건
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

      {/* 입고 내역 테이블 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-20">
          <ArrowDownCircle size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">
            {monthLabel}에 등록된 입고 내역이 없습니다.
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm"
          >
            <Plus size={18} /> 입고 등록
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">
              {monthLabel} 입고 내역
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="px-4 py-3 text-left text-text-muted font-medium">입고일</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">상품</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">매입처</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">수량</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">개당 단가</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">금액</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium hidden md:table-cell">박스 환산</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">비고</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">삭제</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const amount = (log.unit_price || 0) * log.quantity;
                  const boxQty = log.products?.box_quantity ?? 1;
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
                      <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                        +{formatNumber(log.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {log.unit_price > 0 ? formatNumber(log.unit_price) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {amount > 0 ? `${formatNumber(amount)}원` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-text-muted text-xs hidden md:table-cell">
                        {boxQty > 1 ? `${(log.quantity / boxQty).toFixed(1)}박스` : "-"}
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

      {/* 입고 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-emerald-400">입고 등록</h2>
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
                  onChange={(e) => {
                    const product = products.find((p) => p.id === e.target.value);
                    setForm({ ...form, product_id: e.target.value, unit_price: product?.cost_price || 0 });
                  }}
                  required
                  aria-label="입고 상품 선택"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">상품 선택</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}{(p.box_quantity ?? 1) > 1 ? ` · ${p.box_quantity}개/박스` : ""})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">매입처 (공급업체)</label>
                <select
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                  aria-label="매입처 선택"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">매입처 선택 (선택사항)</option>
                  {suppliers.map((c) => (
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
                  <label className="block text-sm text-text-secondary mb-1">단가 (원)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
                    aria-label="단가"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              {form.quantity > 0 && form.unit_price > 0 && (() => {
                const selectedProduct = products.find((p) => p.id === form.product_id);
                const boxQty = selectedProduct?.box_quantity ?? 1;
                const totalAmount = form.quantity * form.unit_price;
                return (
                  <div className="px-4 py-3 rounded-xl bg-bg-dark border border-border space-y-1">
                    <div>
                      <span className="text-sm text-text-muted">개당 단가: </span>
                      <span className="text-sm font-bold text-text-primary">
                        {formatNumber(form.unit_price)}원
                      </span>
                      {boxQty > 1 && (
                        <>
                          <span className="text-sm text-text-muted ml-2">/ 박스 단가: </span>
                          <span className="text-sm font-bold text-primary">
                            {formatNumber(form.unit_price * boxQty)}원
                          </span>
                          <span className="text-xs text-text-muted ml-1">({boxQty}개/박스)</span>
                        </>
                      )}
                    </div>
                    <div>
                      <span className="text-sm text-text-muted">매입 금액: </span>
                      <span className="text-sm font-bold text-accent">
                        {formatNumber(totalAmount)}원
                      </span>
                      {boxQty > 1 && form.quantity >= boxQty && (
                        <span className="text-xs text-text-muted ml-2">
                          ({(form.quantity / boxQty).toFixed(1)}박스)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div>
                <label className="block text-sm text-text-secondary mb-1">입고일</label>
                <input
                  type="date"
                  value={form.log_date}
                  onChange={(e) => setForm({ ...form, log_date: e.target.value })}
                  aria-label="입고일"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">비고</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="예: 정기 발주, 긴급 추가 매입"
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
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
                >
                  입고 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
