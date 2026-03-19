"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  ShoppingCart,
  Receipt,
  Star,
  PenLine,
  FileText,
  Edit2,
  CalendarDays,
  List,
} from "lucide-react";
import Link from "next/link";

type SalesLog = InventoryLog & { companies?: Company | null; products?: Product | null };
type CompanyPrice = { product_id: string; custom_price: number };

interface SaleItem {
  key: number;
  type: "product" | "manual";
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  box_quantity: number; // 1이면 낱개, >1이면 박스 판매
}

let itemKeyCounter = 0;

function newItem(): SaleItem {
  return { key: ++itemKeyCounter, type: "product", product_id: "", product_name: "", unit: "", quantity: 1, unit_price: 0, box_quantity: 1 };
}

function newManualItem(): SaleItem {
  return { key: ++itemKeyCounter, type: "manual", product_id: "", product_name: "", unit: "식", quantity: 1, unit_price: 0, box_quantity: 1 };
}

export default function SalesPage() {
  const supabase = createClient();

  const [tab, setTab] = useState<"list" | "calendar">("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [logs, setLogs] = useState<SalesLog[]>([]);
  const [orders, setOrders] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [statements, setStatements] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  // 월 네비게이션
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // 판매 등록/수정 모달
  const [showModal, setShowModal] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null); // null=신규, string=수정
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formItems, setFormItems] = useState<SaleItem[]>([newItem()]);
  const [formNotes, setFormNotes] = useState("");
  const [companyPrices, setCompanyPrices] = useState<CompanyPrice[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

    const [logRes, prodRes, compRes, orderRes, stmtRes] = await Promise.all([
      db
        .from("inventory_logs")
        .select("*, companies(*), products(*)")
        .eq("type", "out")
        .order("log_date", { ascending: false })
        .limit(500),
      db.from("products").select("*").eq("is_active", true).order("name"),
      db.from("companies").select("*").eq("is_active", true).order("name"),
      db.from("orders").select("*, companies(name)").order("order_date", { ascending: true }).limit(500),
      db.from("statements").select("id, company_id, statement_date, companies(name)").order("statement_date", { ascending: false }).limit(300),
    ]);

    setLogs(logRes.data || []);
    setProducts(prodRes.data || []);
    setCompanies(compRes.data || []);
    setOrders(orderRes.data || []);
    setStatements(stmtRes.data || []);
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

  // 거래처별 판매 집계
  const customerSummary = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; amount: number; count: number }>();
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

  // 업체별 단가 로드
  const loadCompanyPrices = useCallback(async (companyId: string) => {
    if (!companyId) { setCompanyPrices([]); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data } = await db.from("company_prices").select("product_id, custom_price").eq("company_id", companyId);
    setCompanyPrices(data || []);
  }, [supabase]);

  // 업체별 단가 또는 기본 판매단가
  function getProductPrice(productId: string): number {
    const cp = companyPrices.find((p) => p.product_id === productId);
    if (cp) return cp.custom_price;
    const prod = products.find((p) => p.id === productId);
    return prod?.selling_price || 0;
  }

  function hasCustomPrice(productId: string): boolean {
    return companyPrices.some((p) => p.product_id === productId);
  }

  // 업체 변경 시 단가 재적용
  async function handleCompanyChange(companyId: string) {
    setFormCompanyId(companyId);
    await loadCompanyPrices(companyId);
  }

  // 업체 변경 후 기존 품목들의 단가 갱신 (companyPrices가 로드된 후)
  useEffect(() => {
    if (!showModal) return;
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.type !== "product" || !item.product_id) return item;
        const perUnitPrice = getProductPrice(item.product_id);
        const boxQty = item.box_quantity > 1 ? item.box_quantity : 1;
        return { ...item, unit_price: item.unit === "박스" ? perUnitPrice * boxQty : perUnitPrice };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyPrices]);

  // 품목 선택 시: 박스 상품이면 박스 단위/단가를 기본으로
  function handleItemProductChange(index: number, productId: string) {
    const prod = products.find((p) => p.id === productId);
    const perUnitPrice = getProductPrice(productId);
    const boxQty = prod?.box_quantity ?? 1;
    const isBox = boxQty > 1;

    setFormItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              product_id: productId,
              product_name: prod?.name || "",
              unit: isBox ? "박스" : (prod?.unit || ""),
              unit_price: isBox ? perUnitPrice * boxQty : perUnitPrice,
              box_quantity: boxQty,
            }
          : item
      )
    );
  }

  function updateItem(index: number, updates: Partial<SaleItem>) {
    setFormItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  }

  function removeItem(index: number) {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  }

  // 합계
  const formTotal = useMemo(() => {
    return formItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [formItems]);

  function resetForm() {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormCompanyId("");
    setFormItems([newItem()]);
    setFormNotes("");
    setCompanyPrices([]);
    setEditingLogId(null);
  }

  // 수정 모달 열기
  async function openEditModal(log: SalesLog) {
    const isManual = !log.product_id;
    const prod = log.products;
    const boxQty = prod?.box_quantity ?? 1;

    setEditingLogId(log.id);
    setFormDate(log.log_date || log.created_at.slice(0, 10));
    setFormCompanyId(log.company_id || "");
    setFormNotes(isManual ? "" : (log.reason || ""));

    // 업체별 단가 로드
    if (log.company_id) {
      await loadCompanyPrices(log.company_id);
    }

    if (isManual) {
      setFormItems([{
        key: ++itemKeyCounter,
        type: "manual",
        product_id: "",
        product_name: log.reason || "",
        unit: "식",
        quantity: log.quantity,
        unit_price: log.unit_price,
        box_quantity: 1,
      }]);
    } else {
      setFormItems([{
        key: ++itemKeyCounter,
        type: "product",
        product_id: log.product_id || "",
        product_name: prod?.name || "",
        unit: boxQty > 1 ? "박스" : (prod?.unit || ""),
        quantity: boxQty > 1 ? Math.round(log.quantity / boxQty) : log.quantity,
        unit_price: boxQty > 1 ? log.unit_price * boxQty : log.unit_price,
        box_quantity: boxQty,
      }]);
    }

    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = formItems.filter((item) =>
      item.type === "product" ? item.product_id && item.quantity > 0 : item.product_name && item.quantity > 0
    );
    if (validItems.length === 0 || !formCompanyId) return;

    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // 수정 모드: 기존 기록 삭제 후 재등록
    if (editingLogId) {
      const oldLog = logs.find((l) => l.id === editingLogId);
      if (oldLog && oldLog.product_id) {
        // 기존 재고 복원
        const { data: inv } = await db
          .from("inventory")
          .select("*")
          .eq("product_id", oldLog.product_id)
          .maybeSingle();
        if (inv) {
          await db.from("inventory")
            .update({ current_stock: inv.current_stock + oldLog.quantity })
            .eq("product_id", oldLog.product_id);
        }
      }
      await db.from("inventory_logs").delete().eq("id", editingLogId);
    }

    for (const item of validItems) {
      // 실제 개수: 박스 판매면 박스 수 × 박스당 수량
      const actualQty = item.box_quantity > 1 ? item.quantity * item.box_quantity : item.quantity;

      // 판매(출고) 로그
      await db.from("inventory_logs").insert({
        product_id: item.type === "product" ? item.product_id : null,
        type: "out",
        quantity: actualQty,
        reason: item.type === "manual"
          ? item.product_name
          : (formNotes || (item.box_quantity > 1 ? `${item.quantity}박스` : null)),
        company_id: formCompanyId || null,
        unit_price: item.box_quantity > 1 ? Math.round(item.unit_price / item.box_quantity) : (item.unit_price || 0),
        log_date: formDate,
      });

      // 재고 차감 (상품 품목만 - 실제 개수 기준)
      if (item.type === "product" && item.product_id) {
        const { data: inv } = await db
          .from("inventory")
          .select("*")
          .eq("product_id", item.product_id)
          .maybeSingle();

        const newStock = Math.max(0, (inv?.current_stock || 0) - actualQty);

        if (inv) {
          await db
            .from("inventory")
            .update({ current_stock: newStock, last_out_date: formDate })
            .eq("product_id", item.product_id);
        } else {
          await db.from("inventory").insert({
            product_id: item.product_id,
            current_stock: 0,
            last_out_date: formDate,
          });
        }
      }
    }

    setShowModal(false);
    resetForm();
    setSubmitting(false);
    fetchData();
  }

  async function handleDelete(log: SalesLog) {
    if (
      !confirm(
        `이 판매 기록을 삭제하시겠습니까?\n${log.products?.name || log.reason || ""} ${formatNumber(log.quantity)}개`
      )
    )
      return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // 재고 복원 (상품 품목만)
    if (log.product_id) {
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
    }

    await db.from("inventory_logs").delete().eq("id", log.id);
    fetchData();
  }

  // 달력용: 일자별 판매 집계
  const dailySummary = useMemo(() => {
    const map = new Map<string, { count: number; amount: number; logs: SalesLog[]; companies: string[]; companyIds: string[] }>();
    for (const log of monthLogs) {
      const date = (log.log_date || log.created_at).slice(0, 10);
      const existing = map.get(date) || { count: 0, amount: 0, logs: [], companies: [], companyIds: [] };
      existing.count += 1;
      existing.amount += log.quantity * (log.unit_price || 0);
      existing.logs.push(log);
      const companyName = log.companies?.name;
      if (companyName && !existing.companies.includes(companyName)) {
        existing.companies.push(companyName);
      }
      const companyId = log.company_id;
      if (companyId && !existing.companyIds.includes(companyId)) {
        existing.companyIds.push(companyId);
      }
      map.set(date, existing);
    }
    return map;
  }, [monthLogs]);

  // 이번 달 거래명세서 발행된 company_id Set
  const monthStatementCompanyIds = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    const set = new Set<string>();
    for (const s of statements) {
      if (s.statement_date?.startsWith(prefix) && s.company_id) {
        set.add(s.company_id);
      }
    }
    return set;
  }, [statements, month]);

  // 주문 기반 예정 집계 (미래 날짜용)
  const orderSummary = useMemo(() => {
    const map = new Map<string, { count: number; amount: number; companies: string[] }>();
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);
    for (const order of orders) {
      const date = order.order_date?.slice(0, 10);
      if (!date) continue;
      const d = new Date(date);
      if (d < start || d > end) continue;
      const existing = map.get(date) || { count: 0, amount: 0, companies: [] };
      existing.count += 1;
      existing.amount += order.total_amount || 0;
      const name = order.companies?.name;
      if (name && !existing.companies.includes(name)) existing.companies.push(name);
      map.set(date, existing);
    }
    return map;
  }, [orders, month]);

  // 업체별+일자별 판매현황 (목록 탭용)
  type DailyCompanyRow = {
    key: string;
    date: string;
    companyId: string;
    companyName: string;
    logs: SalesLog[];
    amount: number;
  };
  const dailyCompanyRows = useMemo((): DailyCompanyRow[] => {
    const map = new Map<string, DailyCompanyRow>();
    for (const log of monthLogs) {
      const date = (log.log_date || log.created_at).slice(0, 10);
      const companyId = log.company_id || "__none__";
      const key = `${date}::${companyId}`;
      const existing = map.get(key) || {
        key, date, companyId,
        companyName: log.companies?.name || "(미지정)",
        logs: [], amount: 0,
      };
      existing.logs.push(log);
      existing.amount += log.quantity * (log.unit_price || 0);
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date) || a.companyName.localeCompare(b.companyName));
  }, [monthLogs]);

  // 이번 달 발행된 명세서 (거래처별)
  const monthStatementsByCompany = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    const map = new Map<string, { id: string; statement_number: string; statement_date: string }[]>();
    for (const s of statements) {
      if (s.statement_date?.startsWith(prefix) && s.company_id) {
        const arr = map.get(s.company_id) || [];
        arr.push({ id: s.id, statement_number: s.statement_number, statement_date: s.statement_date });
        map.set(s.company_id, arr);
      }
    }
    return map;
  }, [statements, month]);

  // 선택된 행들의 공급가 합계
  const selectedSupply = useMemo(() => {
    return dailyCompanyRows
      .filter(r => selectedRowKeys.has(r.key))
      .reduce((sum, r) => sum + r.amount, 0);
  }, [dailyCompanyRows, selectedRowKeys]);

  // 달력 날짜 배열 생성 (일~토 기준)
  const calendarDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay(); // 0=일
    const lastDate = new Date(y, m, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= lastDate; d++) days.push(d);
    // 6주 채우기
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [month]);

  // 선택된 날짜의 판매 내역
  const selectedDayLogs = useMemo(() => {
    if (!selectedDate) return [];
    return dailySummary.get(selectedDate)?.logs || [];
  }, [selectedDate, dailySummary]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
        <h1 className="text-2xl font-bold text-text-primary">판매 관리</h1>
        <div className="flex items-center gap-3">
          {/* 탭 */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setTab("list")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                tab === "list"
                  ? "bg-primary text-bg-dark"
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
                  ? "bg-primary text-bg-dark"
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
          >
            <Plus size={18} /> 판매 등록
          </button>
        </div>
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-center gap-4 mb-3">
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

      {/* 업체별 당월 누계 통계 */}
      {!loading && customerSummary.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 min-w-[100px]">
            <div className="text-[11px] text-primary font-medium truncate">전체 합계</div>
            <div className="text-sm font-bold text-primary">{formatNumber(monthTotal.totalAmount)}원</div>
          </div>
          {customerSummary.map((c) => (
            <div key={c.id} className="px-3 py-2 rounded-lg bg-bg-card border border-border min-w-[100px]">
              <div className="text-[11px] text-text-muted font-medium truncate">{c.name}</div>
              <div className="text-sm font-bold text-text-primary">{formatNumber(c.amount)}원</div>
            </div>
          ))}
        </div>
      )}

      {tab === "list" && (<>
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

      {/* 선택 요약 바 */}
      {selectedRowKeys.size > 0 && (() => {
        const selectedRows = dailyCompanyRows.filter(r => selectedRowKeys.has(r.key));
        const companyIds = [...new Set(selectedRows.map(r => r.companyId))];
        const supply = selectedSupply;
        const tax = Math.round(supply * 0.1);
        const total = supply + tax;
        return (
          <div className="mb-4 px-5 py-3 rounded-xl border border-primary/40 bg-primary/5 flex flex-wrap items-center gap-4">
            <span className="text-sm text-text-secondary">{selectedRowKeys.size}개 선택</span>
            <span className="text-sm text-text-secondary">공급가: <span className="font-bold text-text-primary">{formatNumber(supply)}원</span></span>
            <span className="text-sm text-text-secondary">부가세(10%): <span className="font-bold text-text-primary">{formatNumber(tax)}원</span></span>
            <span className="text-sm text-text-secondary">합계: <span className="font-bold text-accent">{formatNumber(total)}원</span></span>
            <div className="flex gap-2 ml-auto">
              {companyIds.length > 1 && (
                <span className="text-xs text-red-400">※ 동일 거래처만 선택 가능</span>
              )}
              {companyIds.length === 1 && companyIds[0] !== "__none__" && (
                <Link
                  href={`/admin/statements/new?logIds=${selectedRows.flatMap(r => r.logs.map(l => l.id)).join(",")}&companyId=${companyIds[0]}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
                >
                  <FileText size={14} /> 명세서 발행
                </Link>
              )}
              <button
                type="button"
                onClick={() => setSelectedRowKeys(new Set())}
                className="px-3 py-2 rounded-xl border border-border text-text-muted text-sm hover:text-text-primary transition-colors"
              >
                선택 해제
              </button>
            </div>
          </div>
        );
      })()}

      {/* 업체별·일자별 판매현황 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : dailyCompanyRows.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingCart size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">{monthLabel}에 등록된 판매 내역이 없습니다.</p>
          <button
            type="button"
            onClick={() => { resetForm(); setShowModal(true); }}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm"
          >
            <Plus size={18} /> 판매 등록
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-6">
          <div className="px-6 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">{monthLabel} 판매 내역</h2>
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRowKeys.size === dailyCompanyRows.length && dailyCompanyRows.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedRowKeys(new Set(dailyCompanyRows.map(r => r.key)));
                  else setSelectedRowKeys(new Set());
                }}
                className="rounded"
              />
              전체 선택
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="px-3 py-3 w-8" aria-label="선택" />
                  <th className="px-4 py-3 text-left text-text-muted font-medium">날짜</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">거래처</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">판매품목</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">공급가</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">부가세</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">명세서</th>
                </tr>
              </thead>
              <tbody>
                {dailyCompanyRows.map((row) => {
                  const isSelected = selectedRowKeys.has(row.key);
                  const tax = Math.round(row.amount * 0.1);
                  const stmts = monthStatementsByCompany.get(row.companyId);
                  // 품목 요약: 첫 품목명 + 나머지 수
                  const productNames = [...new Set(row.logs.map(l => l.products?.name || l.reason || "(기타)"))];
                  const productSummary = productNames.length > 1
                    ? `${productNames[0]} 외 ${productNames.length - 1}종`
                    : productNames[0] || "-";
                  return (
                    <tr
                      key={row.key}
                      className={`border-b border-border transition-colors cursor-pointer ${isSelected ? "bg-primary/5" : "hover:bg-bg-card-hover"}`}
                      onClick={() => {
                        setSelectedRowKeys(prev => {
                          const next = new Set(prev);
                          if (next.has(row.key)) next.delete(row.key);
                          else next.add(row.key);
                          return next;
                        });
                      }}
                    >
                      <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`${row.date} ${row.companyName} 선택`}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedRowKeys(prev => {
                              const next = new Set(prev);
                              if (next.has(row.key)) next.delete(row.key);
                              else next.add(row.key);
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-3 text-text-primary font-medium">{row.companyName}</td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{productSummary}</td>
                      <td className="px-4 py-3 text-right font-bold text-accent">{formatNumber(row.amount)}원</td>
                      <td className="px-4 py-3 text-right text-text-muted text-xs">{formatNumber(tax)}원</td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {stmts && stmts.length > 0 ? (
                          <div className="flex flex-col gap-1 items-center">
                            {stmts.map(s => (
                              <Link
                                key={s.id}
                                href={`/admin/statements/${s.id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors"
                              >
                                <FileText size={11} /> 발행됨
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-text-muted/40 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-bg-dark font-bold">
                  <td colSpan={4} className="px-4 py-3 text-right text-text-muted text-xs">합계</td>
                  <td className="px-4 py-3 text-right text-accent">{formatNumber(monthTotal.totalAmount)}원</td>
                  <td className="px-4 py-3 text-right text-text-muted text-xs">{formatNumber(Math.round(monthTotal.totalAmount * 0.1))}원</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 이번 달 발행된 명세서 */}
      {statements.some(s => {
        const [y, m] = month.split("-").map(Number);
        return s.statement_date?.startsWith(`${y}-${String(m).padStart(2, "0")}`);
      }) && (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-6">
          <div className="px-6 py-3 border-b border-border">
            <h2 className="text-base font-semibold text-text-primary">발행된 거래명세서</h2>
          </div>
          <div className="divide-y divide-border">
            {statements
              .filter(s => {
                const [y, m] = month.split("-").map(Number);
                return s.statement_date?.startsWith(`${y}-${String(m).padStart(2, "0")}`);
              })
              .sort((a, b) => b.statement_date.localeCompare(a.statement_date))
              .map(s => (
                <div key={s.id} className="px-6 py-3 flex items-center gap-4">
                  <span className="text-xs text-text-muted w-24">{s.statement_date}</span>
                  <span className="text-sm text-text-primary flex-1">{s.companies?.name || "-"}</span>
                  <span className="text-xs text-text-muted">{s.statement_number}</span>
                  <Link
                    href={`/admin/statements/${s.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                  >
                    <FileText size={12} /> 보기
                  </Link>
                </div>
              ))
            }
          </div>
        </div>
      )}

      </>)}

      {/* 달력 탭 */}
      {tab === "calendar" && (
        <div>
          {/* 달력 그리드 */}
          <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-6">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-border">
              {["일","월","화","수","목","금","토"].map((d, i) => (
                <div
                  key={d}
                  className={`py-3 text-center text-xs font-semibold ${
                    i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-text-muted"
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
                const orderData = orderSummary.get(dateStr);
                const isSelected = selectedDate === dateStr;
                const col = idx % 7;
                const hasFutureOrder = isFuture && !!orderData;

                return (
                  <button
                    type="button"
                    key={dateStr}
                    title={`${dateStr} ${isFuture ? "예정" : "판매"} 현황`}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      resetForm();
                      setFormDate(dateStr);
                      setShowModal(true);
                    }}
                    className={`border-b border-r border-border min-h-[90px] p-2 text-left transition-colors relative ${
                      isSelected
                        ? "bg-primary/10 border-primary/30"
                        : isToday
                        ? "bg-accent/5"
                        : hasFutureOrder
                        ? "bg-sky-900/30 hover:bg-sky-900/50"
                        : isFuture
                        ? "bg-slate-700/20 hover:bg-slate-700/30"
                        : "hover:bg-bg-card-hover"
                    }`}
                  >
                    {/* 날짜 번호 */}
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1 ${
                      isToday
                        ? "bg-accent text-white"
                        : col === 0
                        ? "text-red-400"
                        : col === 6
                        ? "text-blue-400"
                        : isFuture
                        ? "text-slate-400"
                        : "text-text-primary"
                    }`}>
                      {day}
                    </span>

                    {/* 실제 판매 현황 (모든 날짜 - 과거/오늘/미래 모두) */}
                    {dayData && (
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-accent leading-tight">
                          {formatNumber(dayData.amount)}원
                        </div>
                        <div className="text-[10px] text-text-muted">
                          {dayData.count}건
                        </div>
                        {dayData.companies.map((name, ci) => {
                          const cid = dayData.companyIds[ci];
                          const hasStmt = cid ? monthStatementCompanyIds.has(cid) : false;
                          return (
                            <div key={name} className="text-[10px] text-primary/80 truncate leading-tight flex items-center gap-0.5">
                              {hasStmt && <span className="text-emerald-400 font-bold">✓</span>}
                              {name}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!dayData && (isPast || isToday) && (
                      <div className="text-[10px] text-text-muted/40 mt-1">-</div>
                    )}

                    {/* 미래 날짜: 실제 판매 없을 때만 주문 예정 내역 표시 */}
                    {isFuture && !dayData && orderData && (
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-sky-400 leading-tight">
                          {formatNumber(orderData.amount)}원
                        </div>
                        <div className="text-[10px] text-sky-400/70">
                          주문 {orderData.count}건
                        </div>
                        {orderData.companies.map((name) => (
                          <div key={name} className="text-[10px] text-sky-300/70 truncate leading-tight">
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                    {isFuture && !dayData && !orderData && (
                      <div className="text-[10px] text-slate-500/60 mt-1">예정</div>
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
              <span className="w-3 h-3 rounded bg-accent/20 inline-block" />
              판매 있음
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-bg-dark/40 inline-block" />
              예정 (미래)
            </span>
          </div>

          {/* 선택된 날짜 상세 */}
          {selectedDate && (
            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary">
                  {selectedDate} 판매 현황
                  {selectedDate > new Date().toISOString().slice(0, 10) && (
                    <span className="ml-2 text-xs text-yellow-500 font-normal">예정일</span>
                  )}
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
                  {selectedDate > new Date().toISOString().slice(0, 10)
                    ? "아직 등록된 판매 예정 내역이 없습니다."
                    : "이 날 등록된 판매 내역이 없습니다."}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setFormDate(selectedDate);
                        resetForm();
                        setFormDate(selectedDate);
                        setShowModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                      <Plus size={14} /> 이 날 판매 등록
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-dark">
                        <th className="px-4 py-3 text-left text-text-muted font-medium">상품</th>
                        <th className="px-4 py-3 text-left text-text-muted font-medium">거래처</th>
                        <th className="px-4 py-3 text-right text-text-muted font-medium">수량</th>
                        <th className="px-4 py-3 text-right text-text-muted font-medium">단가</th>
                        <th className="px-4 py-3 text-right text-text-muted font-medium">금액</th>
                        <th className="px-4 py-3 text-center text-text-muted font-medium">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDayLogs.map((log) => {
                        const amount = (log.unit_price || 0) * log.quantity;
                        const isManual = !log.product_id;
                        return (
                          <tr key={log.id} className="border-b border-border hover:bg-bg-card-hover transition-colors">
                            <td className="px-4 py-3 text-text-primary font-medium">
                              {isManual ? (
                                <span className="inline-flex items-center gap-1">
                                  <PenLine size={12} className="text-yellow-500" />
                                  {log.reason || "(수작업)"}
                                </span>
                              ) : (
                                log.products?.name || "-"
                              )}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{log.companies?.name || "-"}</td>
                            <td className="px-4 py-3 text-right text-red-400 font-bold">
                              {formatNumber(log.quantity)}
                              <span className="text-text-muted font-normal text-xs ml-1">
                                {log.products?.unit || (isManual ? "식" : "")}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-text-secondary">
                              {log.unit_price > 0 ? formatNumber(log.unit_price) : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-accent">
                              {amount > 0 ? `${formatNumber(amount)}원` : "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(log)}
                                  title="수정"
                                  className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(log)}
                                  title="삭제"
                                  className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-bg-dark font-bold">
                        <td colSpan={4} className="px-4 py-3 text-right text-text-muted text-xs">일계</td>
                        <td className="px-4 py-3 text-right text-accent">
                          {formatNumber(selectedDayLogs.reduce((s, l) => s + l.quantity * (l.unit_price || 0), 0))}원
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 판매 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg-card z-10">
              <h2 className="text-lg font-bold text-primary">{editingLogId ? "판매 수정" : "판매 등록"}</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                title="닫기"
                className="text-text-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* 일자 & 거래처 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    판매일 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    aria-label="판매일"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    거래처 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formCompanyId}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    required
                    aria-label="거래처 선택"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  >
                    <option value="">거래처 선택</option>
                    {companies
                      .filter((c) => {
                        const ct = (c as any).company_type || "customer";
                        return ct === "customer" || ct === "both";
                      })
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 품목 리스트 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text-primary">
                    품목 <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormItems((prev) => [...prev, newItem()])}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      <Plus size={12} /> 품목 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormItems((prev) => [...prev, newManualItem()])}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
                    >
                      <PenLine size={12} /> 수작업 항목
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {formItems.map((item, idx) => (
                    <div
                      key={item.key}
                      className={`rounded-xl border p-3 ${
                        item.type === "manual"
                          ? "border-yellow-500/30 bg-yellow-500/5"
                          : "border-border bg-bg-dark"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* 품목 선택 또는 직접입력 */}
                        <div className="flex-1 min-w-0">
                          {item.type === "product" ? (
                            <select
                              value={item.product_id}
                              onChange={(e) => handleItemProductChange(idx, e.target.value)}
                              aria-label={`품목 ${idx + 1} 선택`}
                              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm focus:outline-none focus:border-primary"
                            >
                              <option value="">상품 선택</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.unit})
                                  {hasCustomPrice(p.id) ? " ★" : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={item.product_name}
                              onChange={(e) => updateItem(idx, { product_name: e.target.value })}
                              placeholder="항목명 (예: 배송비, 금형비, 기타)"
                              aria-label={`수작업 항목 ${idx + 1} 이름`}
                              className="w-full px-3 py-2 rounded-lg border border-yellow-500/30 bg-bg-card text-text-primary text-sm focus:outline-none focus:border-yellow-500"
                            />
                          )}
                        </div>

                        {/* 수량 + 단위 */}
                        <div className="w-24 flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                            aria-label={`품목 ${idx + 1} 수량`}
                            placeholder="수량"
                            className="w-16 px-2 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm text-right focus:outline-none focus:border-primary"
                          />
                          <span className="text-xs text-text-muted whitespace-nowrap">{item.unit || ""}</span>
                        </div>

                        {/* 단가 */}
                        <div className="w-28">
                          <input
                            type="number"
                            min={0}
                            value={item.unit_price}
                            onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                            aria-label={`품목 ${idx + 1} 단가`}
                            placeholder="단가"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm text-right focus:outline-none focus:border-primary"
                          />
                        </div>

                        {/* 금액 */}
                        <div className="w-28 text-right py-2 text-sm font-bold text-accent">
                          {formatNumber(item.quantity * item.unit_price)}원
                        </div>

                        {/* 삭제 */}
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          disabled={formItems.length <= 1}
                          title="항목 삭제"
                          className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* 품목 부가정보 */}
                      {item.type === "product" && item.product_id && (() => {
                        const prod = products.find((p) => p.id === item.product_id);
                        const isCustom = hasCustomPrice(item.product_id);
                        const boxQty = prod?.box_quantity ?? 1;
                        const isBox = boxQty > 1;
                        const perUnitPrice = isBox ? Math.round(item.unit_price / boxQty) : item.unit_price;
                        return (
                          <div className="flex items-center gap-3 mt-1.5 ml-1 text-xs text-text-muted">
                            {isBox && (
                              <span className="text-primary">{boxQty}개/박스 · 개당 {formatNumber(perUnitPrice)}원</span>
                            )}
                            {isCustom && (
                              <span className="inline-flex items-center gap-0.5 text-yellow-500">
                                <Star size={10} /> 업체별 단가
                              </span>
                            )}
                            {isBox && item.quantity > 0 && (
                              <span>= {formatNumber(item.quantity * boxQty)}개</span>
                            )}
                          </div>
                        );
                      })()}

                      {item.type === "manual" && (
                        <div className="flex items-center gap-1 mt-1.5 ml-1 text-xs text-yellow-500/70">
                          <PenLine size={10} /> 수작업 항목 (재고 차감 없음)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 합계 */}
              <div className="rounded-xl bg-bg-dark border border-border p-4 flex items-center justify-between">
                <span className="text-sm text-text-muted">
                  합계 ({formItems.length}건)
                </span>
                <span className="text-xl font-black text-accent">
                  {formatNumber(formTotal)}원
                </span>
              </div>

              {/* 비고 */}
              <div>
                <label className="block text-sm text-text-secondary mb-1">비고</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="예: 정기 납품, 추가 주문"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              {/* 액션 */}
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
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {submitting ? "처리 중..." : editingLogId ? "수정 저장" : "판매 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
