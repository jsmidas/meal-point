"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbInsert, dbUpdate, dbDelete } from "@/lib/db";
import type { InventoryWithProduct, InventoryLog, Product } from "@/lib/supabase/types";
import { formatNumber } from "@/lib/utils";
import type { Company } from "@/lib/supabase/types";
import {
  INVENTORY_LOG_TYPE_BADGE,
  applyLog,
  asLogType,
  logTypeLabel,
} from "@/lib/inventory";
import {
  Warehouse,
  AlertTriangle,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";

type LogWithCompany = InventoryLog & { companies?: Company | null };
type EntryKind = "self" | "adjust";

/** 로그 일자(YYYY-MM-DD). log_date 우선, 없으면 created_at */
function logDay(log: InventoryLog): string {
  return (log.log_date || log.created_at).slice(0, 10);
}

export default function InventoryPage() {
  const supabase = createClient();

  const [inventory, setInventory] = useState<InventoryWithProduct[]>([]);
  const [logs, setLogs] = useState<LogWithCompany[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "zero">("all");

  // 월 네비게이션
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // 안전재고 설정 모달
  const [safetyTarget, setSafetyTarget] = useState<InventoryWithProduct | null>(null);
  const [safetyValue, setSafetyValue] = useState(10);

  // 자가소비 / 재고 조정 등록 모달
  const [showEntry, setShowEntry] = useState(false);
  const [entryKind, setEntryKind] = useState<EntryKind>("self");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryProductId, setEntryProductId] = useState("");
  const [entryQty, setEntryQty] = useState(0);
  const [entryCompanyId, setEntryCompanyId] = useState("");
  const [entryReason, setEntryReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 로그 상세 보기
  const [logProductFilter, setLogProductFilter] = useState<string | null>(null);

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

    const [invRes, logRes, prodRes, compRes] = await Promise.all([
      db.from("inventory").select("*, products(*)").order("products(name)"),
      db
        .from("inventory_logs")
        .select("*, companies(*)")
        .order("log_date", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(5000),
      db.from("products").select("*").eq("is_active", true).order("name"),
      db.from("companies").select("*").eq("is_active", true).order("name"),
    ]);

    setInventory((invRes.data as InventoryWithProduct[]) || []);
    setLogs(logRes.data || []);
    setProducts(prodRes.data || []);
    setCompanies(compRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 수불 현황 계산 (로그를 일자순으로 누적. adjust 는 그 시점 재고를 실사 수량으로 맞춤)
  const stockBalance = useMemo(() => {
    const monthStart = `${month}-01`;

    return inventory.map((inv) => {
      const productLogs = logs
        .filter((l) => l.product_id === inv.product_id)
        .sort((a, b) => logDay(a).localeCompare(logDay(b)) || a.created_at.localeCompare(b.created_at));

      let balance = 0;
      let beginningStock = 0;
      let inbound = 0;
      let inboundAmount = 0;
      let outbound = 0;
      let outboundAmount = 0;
      let selfUse = 0;
      let selfUseAmount = 0;
      let adjust = 0;
      let reachedMonth = false;

      for (const log of productLogs) {
        const day = logDay(log);
        if (day < monthStart) {
          balance = applyLog(balance, log.type, log.quantity);
          continue;
        }
        if (!reachedMonth) {
          beginningStock = balance;
          reachedMonth = true;
        }
        if (!day.startsWith(month)) break; // 다음 달 이후 로그는 제외

        const amount = log.quantity * (log.unit_price || 0);
        switch (asLogType(log.type)) {
          case "in":
            inbound += log.quantity;
            inboundAmount += amount;
            break;
          case "out":
            outbound += log.quantity;
            outboundAmount += amount;
            break;
          case "self":
            selfUse += log.quantity;
            selfUseAmount += amount;
            break;
          case "adjust":
            adjust += log.quantity - balance;
            break;
        }
        balance = applyLog(balance, log.type, log.quantity);
      }
      if (!reachedMonth) beginningStock = balance;

      const endingStock = beginningStock + inbound - outbound - selfUse + adjust;

      return {
        ...inv,
        beginningStock,
        inbound,
        inboundAmount,
        outbound,
        outboundAmount,
        selfUse,
        selfUseAmount,
        adjust,
        endingStock,
      };
    });
  }, [inventory, logs, month]);

  const filtered = stockBalance.filter((inv) => {
    if (filter === "low") return inv.endingStock > 0 && inv.endingStock <= inv.safety_stock;
    if (filter === "zero") return inv.endingStock <= 0;
    return true;
  });

  const lowStockCount = stockBalance.filter(
    (i) => i.endingStock > 0 && i.endingStock <= i.safety_stock
  ).length;
  const zeroStockCount = stockBalance.filter((i) => i.endingStock <= 0).length;
  const totalStock = stockBalance.reduce((s, i) => s + i.endingStock, 0);
  const totalInbound = stockBalance.reduce((s, i) => s + i.inbound, 0);
  const totalOutbound = stockBalance.reduce((s, i) => s + i.outbound, 0);
  const totalSelfUse = stockBalance.reduce((s, i) => s + i.selfUse, 0);

  // 해당 월 로그 (최신순)
  const monthLogs = useMemo(
    () =>
      logs
        .filter((l) => logDay(l).startsWith(month))
        .slice()
        .sort((a, b) => logDay(b).localeCompare(logDay(a)) || b.created_at.localeCompare(a.created_at)),
    [logs, month]
  );

  const filteredLogs = logProductFilter
    ? monthLogs.filter((l) => l.product_id === logProductFilter)
    : monthLogs;

  async function handleSafety(e: React.FormEvent) {
    e.preventDefault();
    if (!safetyTarget) return;
    await dbUpdate("inventory", { safety_stock: safetyValue }, { id: safetyTarget.id });
    setSafetyTarget(null);
    fetchData();
  }

  const productName = (id: string) =>
    products.find((p) => p.id === id)?.name ||
    inventory.find((i) => i.product_id === id)?.products.name ||
    id.slice(0, 8);

  // ── 자가소비 / 재고 조정 등록 ──
  function openEntry(kind: EntryKind, productId = "") {
    setEntryKind(kind);
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryProductId(productId);
    setEntryQty(0);
    setEntryReason("");
    // 자가소비 사용처 기본값: 이름에 '다함'이 들어간 거래처 (본사 우선)
    const daham = companies.find((c) => c.name.includes("다함") && c.name.includes("본사"))
      || companies.find((c) => c.name.includes("다함"));
    setEntryCompanyId(daham?.id || "");
    setShowEntry(true);
  }

  const entryProduct = products.find((p) => p.id === entryProductId);
  const entryBoxQty = entryProduct?.box_quantity ?? 1;
  /** 등록 일자 기준 장부 재고 (그 날까지의 로그 누적) */
  const entryLedgerStock = useMemo(() => {
    if (!entryProductId) return 0;
    let balance = 0;
    const sorted = logs
      .filter((l) => l.product_id === entryProductId && logDay(l) <= entryDate)
      .sort((a, b) => logDay(a).localeCompare(logDay(b)) || a.created_at.localeCompare(b.created_at));
    for (const l of sorted) balance = applyLog(balance, l.type, l.quantity);
    return balance;
  }, [logs, entryProductId, entryDate]);

  async function handleEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryProductId) return;
    if (entryKind === "self" && entryQty <= 0) return;
    if (entryKind === "adjust" && entryQty < 0) return;
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    await dbInsert("inventory_logs", {
      product_id: entryProductId,
      type: entryKind,
      quantity: entryQty,
      reason: entryReason || null,
      company_id: entryKind === "self" ? entryCompanyId || null : null,
      // 자가소비는 매출이 아니므로 원가로 평가, 조정은 금액 없음
      unit_price: entryKind === "self" ? entryProduct?.cost_price || 0 : 0,
      log_date: entryDate,
    });

    const { data: inv } = await db
      .from("inventory")
      .select("*")
      .eq("product_id", entryProductId)
      .maybeSingle();
    const newStock =
      entryKind === "self" ? Math.max(0, (inv?.current_stock || 0) - entryQty) : entryQty;
    if (inv) {
      await dbUpdate(
        "inventory",
        entryKind === "self"
          ? { current_stock: newStock, last_out_date: entryDate }
          : { current_stock: newStock },
        { product_id: entryProductId }
      );
    } else {
      await dbInsert("inventory", { product_id: entryProductId, current_stock: newStock });
    }

    setSubmitting(false);
    setShowEntry(false);
    fetchData();
  }

  async function handleDeleteLog(log: LogWithCompany) {
    const kind = asLogType(log.type);
    if (kind !== "self" && kind !== "adjust") return;
    if (
      !confirm(
        `${logTypeLabel(log.type)} 기록을 삭제하시겠습니까?\n${log.product_id ? productName(log.product_id) : ""} ${formatNumber(log.quantity)}개`
      )
    )
      return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    if (kind === "self" && log.product_id) {
      const { data: inv } = await db
        .from("inventory")
        .select("*")
        .eq("product_id", log.product_id)
        .maybeSingle();
      if (inv) {
        await dbUpdate("inventory", { current_stock: inv.current_stock + log.quantity }, { product_id: log.product_id });
      }
    }
    await dbDelete("inventory_logs", { id: log.id });
    fetchData();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">재고 수불 현황</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => openEntry("self")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/10 text-violet-400 ring-1 ring-violet-400/30 hover:bg-violet-500/20 transition-colors"
          >
            <Plus size={16} /> 자가소비 등록
          </button>
          <button
            type="button"
            onClick={() => openEntry("adjust")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-400/30 hover:bg-sky-500/20 transition-colors"
          >
            <Plus size={16} /> 재고 조정(실사)
          </button>
          <Link
            href="/admin/inbound"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10 transition-colors"
          >
            입고 관리 &rarr;
          </Link>
          <Link
            href="/admin/sales"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            판매 관리 &rarr;
          </Link>
        </div>
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs text-text-muted mb-1">기말재고 합계</p>
          <p className={`text-2xl font-bold ${totalStock < 0 ? "text-red-400" : "text-text-primary"}`}>
            {formatNumber(totalStock)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs text-emerald-400 mb-1">당월 입고</p>
          <p className="text-2xl font-bold text-emerald-400">+{formatNumber(totalInbound)}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs text-red-400 mb-1">당월 출고(판매)</p>
          <p className="text-2xl font-bold text-red-400">-{formatNumber(totalOutbound)}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs text-violet-400 mb-1">당월 자가소비</p>
          <p className="text-2xl font-bold text-violet-400">-{formatNumber(totalSelfUse)}</p>
        </div>
        <div
          className="rounded-xl border border-border bg-bg-card p-5 cursor-pointer hover:border-yellow-400/30 transition-colors"
          onClick={() => setFilter(filter === "low" ? "all" : "low")}
        >
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={12} className="text-yellow-400" />
            <p className="text-xs text-text-muted">안전재고 미달</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{lowStockCount}건</p>
        </div>
        <div
          className="rounded-xl border border-border bg-bg-card p-5 cursor-pointer hover:border-red-400/30 transition-colors"
          onClick={() => setFilter(filter === "zero" ? "all" : "zero")}
        >
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={12} className="text-red-400" />
            <p className="text-xs text-text-muted">재고 소진</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{zeroStockCount}건</p>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-4">
        {(
          [
            ["all", "전체"],
            ["low", "안전재고 미달"],
            ["zero", "재고 소진"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === key
                ? "bg-primary/10 text-primary ring-1 ring-primary"
                : "bg-bg-dark text-text-secondary hover:text-text-primary border border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 수불 현황 테이블 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="px-4 py-3 text-left text-text-muted font-medium">상품</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">기초재고</th>
                  <th className="px-4 py-3 text-right text-emerald-400 font-medium">입고</th>
                  <th className="px-4 py-3 text-right text-red-400 font-medium">출고(판매)</th>
                  <th className="px-4 py-3 text-right text-violet-400 font-medium">자가소비</th>
                  <th className="px-4 py-3 text-right text-sky-400 font-medium">조정</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">기말재고</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">안전재고</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">상태</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">설정</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const isLow = inv.endingStock > 0 && inv.endingStock <= inv.safety_stock;
                  const isZero = inv.endingStock <= 0;
                  const boxQty = inv.products.box_quantity ?? 1;

                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-border hover:bg-bg-card-hover transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-text-primary font-medium">{inv.products.name}</p>
                        <p className="text-xs text-text-muted">
                          {inv.products.category} · {inv.products.unit}
                          {boxQty > 1 && ` · ${boxQty}개/박스`}
                        </p>
                      </td>
                      <td className={`px-4 py-3 text-right ${inv.beginningStock < 0 ? "text-red-400" : "text-text-secondary"}`}>
                        {formatNumber(inv.beginningStock)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                        {inv.inbound > 0 ? `+${formatNumber(inv.inbound)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-red-400 font-medium">
                        {inv.outbound > 0 ? `-${formatNumber(inv.outbound)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-violet-400 font-medium">
                        {inv.selfUse > 0 ? `-${formatNumber(inv.selfUse)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-sky-400 font-medium">
                        {inv.adjust !== 0 ? `${inv.adjust > 0 ? "+" : ""}${formatNumber(inv.adjust)}` : "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          isZero ? "text-red-400" : isLow ? "text-yellow-400" : "text-text-primary"
                        }`}
                      >
                        {formatNumber(inv.endingStock)}
                        {boxQty > 1 && inv.endingStock > 0 && (
                          <span className="text-xs text-text-muted font-normal ml-1">
                            ({(inv.endingStock / boxQty).toFixed(1)}박스)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {formatNumber(inv.safety_stock)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {inv.endingStock < 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-400/10 text-red-400" title="장부 재고가 음수입니다. 기초재고·입고 누락분을 재고 조정(실사)으로 맞추세요.">
                            장부 불일치
                          </span>
                        ) : isZero ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-400/10 text-red-400">소진</span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-400/10 text-yellow-400">부족</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400/10 text-emerald-400">정상</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEntry("self", inv.product_id)}
                            className="p-1.5 rounded-lg hover:bg-violet-400/10 text-text-muted hover:text-violet-400 transition-colors text-xs font-bold"
                            title="이 상품 자가소비 등록"
                          >
                            자
                          </button>
                          <button
                            onClick={() => openEntry("adjust", inv.product_id)}
                            className="p-1.5 rounded-lg hover:bg-sky-400/10 text-text-muted hover:text-sky-400 transition-colors text-xs font-bold"
                            title="이 상품 재고 조정(실사)"
                          >
                            조
                          </button>
                          <button
                            onClick={() => {
                              setSafetyTarget(inv);
                              setSafetyValue(inv.safety_stock);
                            }}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                            title="안전재고 설정"
                          >
                            <Settings size={16} />
                          </button>
                          <button
                            onClick={() =>
                              setLogProductFilter(
                                logProductFilter === inv.product_id ? null : inv.product_id
                              )
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              logProductFilter === inv.product_id
                                ? "bg-primary/10 text-primary"
                                : "text-text-muted hover:text-text-primary hover:bg-bg-dark"
                            }`}
                            title="입출고 이력"
                          >
                            <Warehouse size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-text-muted">
                      {filter === "all"
                        ? "등록된 재고가 없습니다. 입고 관리에서 먼저 입고를 등록하세요."
                        : "해당하는 항목이 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 입출고 이력 */}
      {filteredLogs.length > 0 && (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">
              {logProductFilter
                ? `${productName(logProductFilter)} 입출고 이력`
                : `${monthLabel} 입출고 이력`}
            </h2>
            {logProductFilter && (
              <button
                onClick={() => setLogProductFilter(null)}
                className="text-sm text-text-muted hover:text-text-primary"
              >
                전체 보기
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="px-4 py-3 text-left text-text-muted font-medium">일자</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">유형</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">상품</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">거래처</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">수량</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">개당 단가</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">금액</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium hidden md:table-cell">박스 환산</th>
                  <th className="px-4 py-3 text-left text-text-muted font-medium">비고</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, 50).map((log) => {
                  const kind = asLogType(log.type);
                  const unitPrice = log.unit_price || 0;
                  const amount = unitPrice * log.quantity;
                  const sign = kind === "in" ? "+" : kind === "adjust" ? "=" : "-";
                  const qtyColor =
                    kind === "in"
                      ? "text-emerald-400"
                      : kind === "self"
                        ? "text-violet-400"
                        : kind === "adjust"
                          ? "text-sky-400"
                          : "text-red-400";
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-bg-card-hover transition-colors"
                    >
                      <td className="px-4 py-3 text-text-secondary text-xs">
                        {new Date(log.log_date || log.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVENTORY_LOG_TYPE_BADGE[kind]}`}>
                          {logTypeLabel(kind)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-primary font-medium">
                        {log.product_id ? productName(log.product_id) : (log.reason || "-")}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {log.companies?.name || "-"}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${qtyColor}`}>
                        {sign}
                        {formatNumber(log.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {unitPrice > 0 ? formatNumber(unitPrice) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {amount > 0 ? formatNumber(amount) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-text-muted text-xs hidden md:table-cell">
                        {(() => {
                          const prod = products.find((p) => p.id === log.product_id);
                          const bq = prod?.box_quantity ?? 1;
                          return bq > 1 ? `${(log.quantity / bq).toFixed(1)}박스` : "-";
                        })()}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">{log.reason || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {kind === "self" || kind === "adjust" ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log)}
                            title="삭제"
                            className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-text-muted" title="입고 관리 / 판매 관리에서 수정">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 자가소비 / 재고 조정 등록 모달 */}
      {showEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">
                {entryKind === "self" ? "자가소비 등록" : "재고 조정(실사)"}
              </h2>
              <button
                type="button"
                onClick={() => setShowEntry(false)}
                title="닫기"
                className="text-text-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEntry} className="p-6 space-y-4">
              {/* 구분 */}
              <div className="flex gap-2">
                {(
                  [
                    ["self", "자가소비"],
                    ["adjust", "재고 조정(실사)"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setEntryKind(key); setEntryQty(0); }}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      entryKind === key
                        ? key === "self"
                          ? "bg-violet-500/10 text-violet-400 ring-1 ring-violet-400"
                          : "bg-sky-500/10 text-sky-400 ring-1 ring-sky-400"
                        : "bg-bg-dark text-text-secondary hover:text-text-primary border border-border"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-muted">
                {entryKind === "self"
                  ? "자가소비는 재고만 차감되고 매출·청구·거래명세서·손익에는 포함되지 않습니다."
                  : "실사로 센 수량을 입력하면 그 날짜의 장부 재고를 그 수량으로 맞춥니다. 기초재고·입고 누락분을 바로잡을 때 사용하세요."}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    일자 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                    aria-label="일자"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                {entryKind === "self" && (
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">사용처</label>
                    <select
                      value={entryCompanyId}
                      onChange={(e) => setEntryCompanyId(e.target.value)}
                      aria-label="사용처 선택"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="">(미지정)</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  상품 <span className="text-red-400">*</span>
                </label>
                <select
                  value={entryProductId}
                  onChange={(e) => setEntryProductId(e.target.value)}
                  required
                  aria-label="상품 선택"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">상품 선택</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}{(p.box_quantity ?? 1) > 1 ? `, ${p.box_quantity}개/박스` : ""})
                    </option>
                  ))}
                </select>
                {entryProductId && (
                  <p className="text-xs text-text-muted mt-1">
                    {entryDate} 기준 장부 재고:{" "}
                    <span className={entryLedgerStock < 0 ? "text-red-400 font-medium" : "text-text-primary font-medium"}>
                      {formatNumber(entryLedgerStock)}
                    </span>
                    {entryBoxQty > 1 && ` (${(entryLedgerStock / entryBoxQty).toFixed(1)}박스)`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  {entryKind === "self" ? "자가소비 수량(개)" : "실사 수량(개)"} <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min={entryKind === "self" ? 1 : 0}
                  value={entryQty}
                  onChange={(e) => setEntryQty(Number(e.target.value))}
                  required
                  aria-label="수량"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
                <div className="flex items-center justify-between mt-1 text-xs text-text-muted">
                  <span>
                    {entryBoxQty > 1 && entryQty > 0 && `${(entryQty / entryBoxQty).toFixed(1)}박스`}
                  </span>
                  {entryProductId && entryKind === "adjust" && (
                    <span>
                      조정량:{" "}
                      <span className={`font-medium ${entryQty - entryLedgerStock >= 0 ? "text-sky-400" : "text-red-400"}`}>
                        {entryQty - entryLedgerStock >= 0 ? "+" : ""}
                        {formatNumber(entryQty - entryLedgerStock)}
                      </span>
                    </span>
                  )}
                  {entryProductId && entryKind === "self" && entryProduct?.cost_price ? (
                    <span>원가 평가액 {formatNumber(entryQty * entryProduct.cost_price)}원</span>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">비고</label>
                <input
                  type="text"
                  value={entryReason}
                  onChange={(e) => setEntryReason(e.target.value)}
                  placeholder={entryKind === "self" ? "예: 다함푸드 자체 사용분" : "예: 10월 실사, 기초재고 반영"}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEntry(false)}
                  className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-6 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 ${
                    entryKind === "self"
                      ? "bg-violet-500 text-white hover:bg-violet-600"
                      : "bg-sky-500 text-white hover:bg-sky-600"
                  }`}
                >
                  {submitting ? "처리 중..." : entryKind === "self" ? "자가소비 등록" : "재고 조정"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 안전재고 설정 모달 */}
      {safetyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">안전재고 설정</h2>
              <button
                onClick={() => setSafetyTarget(null)}
                title="닫기"
                className="text-text-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSafety} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">상품명</label>
                <p className="px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary">
                  {safetyTarget.products.name}
                </p>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">안전재고 수량</label>
                <input
                  type="number"
                  min={0}
                  value={safetyValue}
                  onChange={(e) => setSafetyValue(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSafetyTarget(null)}
                  className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
