"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InventoryWithProduct, InventoryLog, Product } from "@/lib/supabase/types";
import { formatNumber } from "@/lib/utils";
import type { Company } from "@/lib/supabase/types";
import {
  Warehouse,
  AlertTriangle,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

type LogWithCompany = InventoryLog & { companies?: Company | null };

export default function InventoryPage() {
  const supabase = createClient();

  const [inventory, setInventory] = useState<InventoryWithProduct[]>([]);
  const [logs, setLogs] = useState<LogWithCompany[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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

    const [invRes, logRes, prodRes] = await Promise.all([
      db.from("inventory").select("*, products(*)").order("products(name)"),
      db
        .from("inventory_logs")
        .select("*, companies(*)")
        .order("log_date", { ascending: false })
        .limit(500),
      db.from("products").select("*").eq("is_active", true).order("name"),
    ]);

    setInventory((invRes.data as InventoryWithProduct[]) || []);
    setLogs(logRes.data || []);
    setProducts(prodRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 수불 현황 계산
  const stockBalance = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59);

    return inventory.map((inv) => {
      const productLogs = logs.filter((l) => l.product_id === inv.product_id);

      let beginningStock = 0;
      let inbound = 0;
      let inboundAmount = 0;
      let outbound = 0;
      let outboundAmount = 0;

      for (const log of productLogs) {
        const logDate = new Date(log.log_date || log.created_at);
        if (logDate < monthStart) {
          if (log.type === "in") beginningStock += log.quantity;
          else if (log.type === "out") beginningStock -= log.quantity;
          else beginningStock = log.quantity;
        } else if (logDate >= monthStart && logDate <= monthEnd) {
          if (log.type === "in") {
            inbound += log.quantity;
            inboundAmount += log.quantity * (log.unit_price || 0);
          } else if (log.type === "out") {
            outbound += log.quantity;
            outboundAmount += log.quantity * (log.unit_price || 0);
          }
        }
      }

      const endingStock = beginningStock + inbound - outbound;

      return {
        ...inv,
        beginningStock: Math.max(0, beginningStock),
        inbound,
        inboundAmount,
        outbound,
        outboundAmount,
        endingStock: Math.max(0, endingStock),
      };
    });
  }, [inventory, logs, month]);

  const filtered = stockBalance.filter((inv) => {
    if (filter === "low") return inv.endingStock > 0 && inv.endingStock <= inv.safety_stock;
    if (filter === "zero") return inv.endingStock === 0;
    return true;
  });

  const lowStockCount = stockBalance.filter(
    (i) => i.endingStock > 0 && i.endingStock <= i.safety_stock
  ).length;
  const zeroStockCount = stockBalance.filter((i) => i.endingStock === 0).length;
  const totalStock = stockBalance.reduce((s, i) => s + i.endingStock, 0);
  const totalInbound = stockBalance.reduce((s, i) => s + i.inbound, 0);
  const totalOutbound = stockBalance.reduce((s, i) => s + i.outbound, 0);

  // 해당 월 로그
  const monthLogs = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59);
    return logs.filter((l) => {
      const d = new Date(l.log_date || l.created_at);
      return d >= monthStart && d <= monthEnd;
    });
  }, [logs, month]);

  const filteredLogs = logProductFilter
    ? monthLogs.filter((l) => l.product_id === logProductFilter)
    : monthLogs;

  async function handleSafety(e: React.FormEvent) {
    e.preventDefault();
    if (!safetyTarget) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("inventory")
      .update({ safety_stock: safetyValue })
      .eq("id", safetyTarget.id);
    setSafetyTarget(null);
    fetchData();
  }

  const productName = (id: string) =>
    products.find((p) => p.id === id)?.name ||
    inventory.find((i) => i.product_id === id)?.products.name ||
    id.slice(0, 8);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">재고 수불 현황</h1>
        <div className="flex gap-2 text-sm">
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs text-text-muted mb-1">기말재고 합계</p>
          <p className="text-2xl font-bold text-text-primary">{formatNumber(totalStock)}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs text-emerald-400 mb-1">당월 입고</p>
          <p className="text-2xl font-bold text-emerald-400">+{formatNumber(totalInbound)}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="text-xs text-red-400 mb-1">당월 출고</p>
          <p className="text-2xl font-bold text-red-400">-{formatNumber(totalOutbound)}</p>
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
                  <th className="px-4 py-3 text-right text-text-muted font-medium">기말재고</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">안전재고</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">상태</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">설정</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const isLow = inv.endingStock > 0 && inv.endingStock <= inv.safety_stock;
                  const isZero = inv.endingStock === 0;

                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-border hover:bg-bg-card-hover transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-text-primary font-medium">{inv.products.name}</p>
                        <p className="text-xs text-text-muted">
                          {inv.products.category} · {inv.products.unit}
                          {(inv.products.box_quantity ?? 1) > 1 && ` · ${inv.products.box_quantity}개/박스`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {formatNumber(inv.beginningStock)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                        {inv.inbound > 0 ? `+${formatNumber(inv.inbound)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-red-400 font-medium">
                        {inv.outbound > 0 ? `-${formatNumber(inv.outbound)}` : "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          isZero ? "text-red-400" : isLow ? "text-yellow-400" : "text-text-primary"
                        }`}
                      >
                        {formatNumber(inv.endingStock)}
                        {(inv.products.box_quantity ?? 1) > 1 && inv.endingStock > 0 && (
                          <span className="text-xs text-text-muted font-normal ml-1">
                            ({(inv.endingStock / inv.products.box_quantity).toFixed(1)}박스)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {formatNumber(inv.safety_stock)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isZero ? (
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
                    <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
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
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, 50).map((log) => {
                  const isIn = log.type === "in";
                  const unitPrice = log.unit_price || 0;
                  const amount = unitPrice * log.quantity;
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-bg-card-hover transition-colors"
                    >
                      <td className="px-4 py-3 text-text-secondary text-xs">
                        {new Date(log.log_date || log.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            isIn
                              ? "bg-emerald-400/10 text-emerald-400"
                              : "bg-red-400/10 text-red-400"
                          }`}
                        >
                          {isIn ? "입고(매입)" : "출고(판매)"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-primary font-medium">
                        {productName(log.product_id)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {log.companies?.name || "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          isIn ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {isIn ? "+" : "-"}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
