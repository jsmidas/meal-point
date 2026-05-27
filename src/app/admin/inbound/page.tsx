"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product, Company, InventoryLog } from "@/lib/supabase/types";
import { formatNumber, formatDate } from "@/lib/utils";
import { dbInsert, dbUpdate, dbDelete } from "@/lib/db";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
  X,
  Trash2,
  Building2,
  Package,
  CalendarDays,
  List,
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

  // 탭 (목록 / 달력)
  const [tab, setTab] = useState<"list" | "calendar">("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // 날짜별 집계 (달력용) — 매입처 필터 적용
  const dailySummary = useMemo(() => {
    const map = new Map<string, {
      count: number;
      amount: number;
      qty: number;
      logs: InboundLog[];
      suppliers: string[];
      supplierIds: string[];
      supplierAmounts: Map<string, number>;
    }>();
    for (const log of filteredLogs) {
      const date = (log.log_date || log.created_at).slice(0, 10);
      const existing = map.get(date) || {
        count: 0, amount: 0, qty: 0,
        logs: [] as InboundLog[],
        suppliers: [] as string[],
        supplierIds: [] as string[],
        supplierAmounts: new Map<string, number>(),
      };
      const logAmount = log.quantity * (log.unit_price || 0);
      existing.count += 1;
      existing.qty += log.quantity;
      existing.amount += logAmount;
      existing.logs.push(log);
      const supplierName = log.companies?.name || "(미지정)";
      const supplierId = log.company_id || "__none__";
      if (!existing.suppliers.includes(supplierName)) existing.suppliers.push(supplierName);
      if (!existing.supplierIds.includes(supplierId)) existing.supplierIds.push(supplierId);
      existing.supplierAmounts.set(supplierId, (existing.supplierAmounts.get(supplierId) || 0) + logAmount);
      map.set(date, existing);
    }
    return map;
  }, [filteredLogs]);

  // 달력 날짜 배열 (일~토)
  const calendarDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay();
    const lastDate = new Date(y, m, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= lastDate; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [month]);

  // 선택일 입고 내역 (매입처 마스터 순서로 정렬)
  const selectedDayLogs = useMemo(() => {
    if (!selectedDate) return [];
    const raw = dailySummary.get(selectedDate)?.logs || [];
    const order = new Map<string, number>();
    companies.forEach((c, i) => order.set(c.id, i));
    const NONE = Number.MAX_SAFE_INTEGER;
    return [...raw].sort((a, b) => {
      const ai = a.company_id ? order.get(a.company_id) ?? NONE : NONE;
      const bi = b.company_id ? order.get(b.company_id) ?? NONE : NONE;
      return ai - bi;
    });
  }, [selectedDate, dailySummary, companies]);

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
    await dbInsert("inventory_logs", {
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
      await dbUpdate("inventory", { current_stock: newStock, last_in_date: form.log_date }, { product_id: form.product_id });
    } else {
      await dbInsert("inventory", {
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
      await dbUpdate("inventory", { current_stock: newStock }, { product_id: log.product_id });
    }

    // 로그 삭제
    await dbDelete("inventory_logs", { id: log.id });
    fetchData();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
        <h1 className="text-2xl font-bold text-text-primary">입고 관리 (매입)</h1>
        <div className="flex items-center gap-3">
          {/* 탭 */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setTab("list")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                tab === "list"
                  ? "bg-emerald-500 text-white"
                  : "bg-bg-card text-text-muted hover:text-text-primary"
              }`}
            >
              <List size={15} /> 목록
            </button>
            <button
              type="button"
              onClick={() => setTab("calendar")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                tab === "calendar"
                  ? "bg-emerald-500 text-white"
                  : "bg-bg-card text-text-muted hover:text-text-primary"
              }`}
            >
              <CalendarDays size={15} /> 달력
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors"
          >
            <Plus size={18} /> 입고 등록
          </button>
        </div>
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          type="button"
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
          type="button"
          onClick={() => changeMonth(1)}
          title="다음 월"
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 매입처별 당월 누계 칩 */}
      {!loading && supplierSummary.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 min-w-[110px]">
            <div className="text-[11px] text-emerald-400 font-medium truncate">전체 합계</div>
            <div className="text-sm font-bold text-emerald-400">{formatNumber(monthTotal.totalAmount)}원</div>
            <div className="text-[10px] text-emerald-400/70">{filteredLogs.length}건</div>
          </div>
          {supplierSummary.map((s) => (
            <div key={s.id} className="px-3 py-2 rounded-lg bg-bg-card border border-border min-w-[110px]">
              <div className="text-[11px] text-text-muted font-medium truncate">{s.name}</div>
              <div className="text-sm font-bold text-text-primary">{formatNumber(s.amount)}원</div>
              <div className="text-[10px] text-text-muted">{s.count}건</div>
            </div>
          ))}
        </div>
      )}

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

      {tab === "list" && (<>
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
            type="button"
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
                        {log.products?.name || log.product_id?.slice(0, 8) || "-"}
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
                          type="button"
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
      </>)}

      {/* 달력 탭 */}
      {tab === "calendar" && (
        <div>
          <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-6">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-border">
              {["일","월","화","수","목","금","토"].map((d, i) => (
                <div
                  key={d}
                  className={`py-4 text-center text-3xl font-bold ${
                    i === 0 ? "text-red-300" : i === 6 ? "text-blue-300" : "text-text-primary"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 셀 */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="border-b border-r border-border min-h-[90px] bg-bg-dark/30" />;
                }
                const [y, m] = month.split("-").map(Number);
                const dateStr = `${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const today = new Date().toISOString().slice(0, 10);
                const isPast = dateStr < today;
                const isToday = dateStr === today;
                const isFuture = dateStr > today;
                const dayData = dailySummary.get(dateStr);
                const isSelected = selectedDate === dateStr;
                const col = idx % 7;

                return (
                  <button
                    type="button"
                    key={dateStr}
                    title={`${dateStr} 입고 현황`}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      resetForm();
                      setForm((f) => ({ ...f, log_date: dateStr }));
                      setShowModal(true);
                    }}
                    className={`flex flex-col items-start justify-start border-b border-r border-border min-h-[90px] px-1 pt-0.5 pb-0.5 text-left transition-colors relative ${
                      isSelected
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : isToday
                        ? "bg-accent/5"
                        : isFuture
                        ? "bg-slate-700/20 hover:bg-slate-700/30"
                        : "hover:bg-bg-card-hover"
                    }`}
                  >
                    {/* 날짜 번호 */}
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold leading-none ${
                      isToday
                        ? "bg-accent text-white"
                        : col === 0
                        ? "text-red-300"
                        : col === 6
                        ? "text-blue-300"
                        : isFuture
                        ? "text-slate-200"
                        : "text-text-primary"
                    }`}>
                      {day}
                    </span>

                    {/* 입고 현황 */}
                    {dayData && (
                      <div className="space-y-0.5 w-full mt-0.5">
                        {dayData.suppliers.map((name, ci) => {
                          const sid = dayData.supplierIds[ci];
                          const amt = sid ? dayData.supplierAmounts.get(sid) || 0 : 0;
                          return (
                            <div key={name} className="flex items-center gap-1 text-xs leading-tight">
                              <span className="text-emerald-300 truncate font-medium">{name}</span>
                              <span className="text-accent font-bold ml-auto flex-shrink-0">{formatNumber(amt)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!dayData && (isPast || isToday) && (
                      <div className="text-xs text-text-muted/70 mt-1">-</div>
                    )}
                    {!dayData && isFuture && (
                      <div className="text-xs text-slate-300 mt-1">예정</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 범례 */}
          <div className="flex items-center gap-4 text-xs text-text-muted mb-6 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-accent inline-block" />
              오늘
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500/20 inline-block" />
              입고 있음
            </span>
            <span className="text-text-muted/70">· 셀 더블클릭 → 해당일 신규 입고</span>
          </div>

          {/* 선택일 상세 */}
          {selectedDate && (
            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary">
                  {selectedDate} 입고 현황
                </h2>
                <button
                  type="button"
                  title="닫기"
                  onClick={() => setSelectedDate(null)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X size={18} />
                </button>
              </div>

              {selectedDayLogs.length === 0 ? (
                <div className="px-6 py-10 text-center text-text-muted text-sm">
                  이 날 등록된 입고 내역이 없습니다.
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setForm((f) => ({ ...f, log_date: selectedDate }));
                        setShowModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                    >
                      <Plus size={14} /> 이 날 입고 등록
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-dark">
                        <th className="px-4 py-3 text-left text-text-muted font-medium">상품</th>
                        <th className="px-4 py-3 text-left text-text-muted font-medium">매입처</th>
                        <th className="px-4 py-3 text-right text-text-muted font-medium">수량</th>
                        <th className="px-4 py-3 text-right text-text-muted font-medium">단가</th>
                        <th className="px-4 py-3 text-right text-text-muted font-medium">금액</th>
                        <th className="px-4 py-3 text-left text-text-muted font-medium">비고</th>
                        <th className="px-4 py-3 text-center text-text-muted font-medium">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDayLogs.map((log) => {
                        const amount = (log.unit_price || 0) * log.quantity;
                        return (
                          <tr key={log.id} className="border-b border-border hover:bg-bg-card-hover transition-colors">
                            <td className="px-4 py-3 text-text-primary font-medium">
                              {log.products?.name || log.product_id?.slice(0, 8) || "-"}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{log.companies?.name || "-"}</td>
                            <td className="px-4 py-3 text-right text-emerald-400 font-bold">+{formatNumber(log.quantity)}</td>
                            <td className="px-4 py-3 text-right text-text-secondary">
                              {log.unit_price > 0 ? formatNumber(log.unit_price) : "-"}
                            </td>
                            <td className="px-4 py-3 text-right text-text-secondary">
                              {amount > 0 ? `${formatNumber(amount)}원` : "-"}
                            </td>
                            <td className="px-4 py-3 text-text-muted text-xs">{log.reason || "-"}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
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
              )}
            </div>
          )}
        </div>
      )}

      {/* 입고 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-emerald-400">입고 등록</h2>
              <button
                type="button"
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
