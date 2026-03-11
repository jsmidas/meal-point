"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InventoryWithProduct, InventoryLog, Product } from "@/lib/supabase/types";
import { INVENTORY_LOG_TYPES, formatNumber } from "@/lib/utils";
import { Warehouse, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Settings, X, Plus } from "lucide-react";

export default function InventoryPage() {
  const supabase = createClient();

  const [inventory, setInventory] = useState<InventoryWithProduct[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "zero">("all");

  // 입출고 모달
  const [showLog, setShowLog] = useState(false);
  const [logProductId, setLogProductId] = useState("");
  const [logType, setLogType] = useState<"in" | "out" | "adjust">("in");
  const [logQty, setLogQty] = useState(1);
  const [logReason, setLogReason] = useState("");

  // 안전재고 설정 모달
  const [safetyTarget, setSafetyTarget] = useState<InventoryWithProduct | null>(null);
  const [safetyValue, setSafetyValue] = useState(10);

  // 로그 상세 보기
  const [logProductFilter, setLogProductFilter] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const [invRes, logRes, prodRes] = await Promise.all([
      db.from("inventory").select("*, products(*)").order("products(name)"),
      db.from("inventory_logs").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("products").select("*").eq("is_active", true).order("name"),
    ]);

    setInventory((invRes.data as InventoryWithProduct[]) || []);
    setLogs(logRes.data || []);
    setProducts(prodRes.data || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = inventory.filter((inv) => {
    if (filter === "low") return inv.current_stock > 0 && inv.current_stock <= inv.safety_stock;
    if (filter === "zero") return inv.current_stock === 0;
    return true;
  });

  const lowStockCount = inventory.filter((i) => i.current_stock > 0 && i.current_stock <= i.safety_stock).length;
  const zeroStockCount = inventory.filter((i) => i.current_stock === 0).length;
  const totalStock = inventory.reduce((s, i) => s + i.current_stock, 0);

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logProductId || logQty <= 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // 로그 기록
    await db.from("inventory_logs").insert({
      product_id: logProductId,
      type: logType,
      quantity: logQty,
      reason: logReason || null,
    });

    // 재고 업데이트
    const inv = inventory.find((i) => i.product_id === logProductId);
    let newStock = inv ? inv.current_stock : 0;
    if (logType === "in") newStock += logQty;
    else if (logType === "out") newStock = Math.max(0, newStock - logQty);
    else newStock = logQty; // adjust = 직접 설정

    const today = new Date().toISOString().slice(0, 10);
    const updateData: Record<string, unknown> = { current_stock: newStock };
    if (logType === "in") updateData.last_in_date = today;
    if (logType === "out") updateData.last_out_date = today;

    if (inv) {
      await db.from("inventory").update(updateData).eq("product_id", logProductId);
    } else {
      await db.from("inventory").insert({ product_id: logProductId, ...updateData });
    }

    setShowLog(false);
    setLogProductId("");
    setLogQty(1);
    setLogReason("");
    fetchData();
  }

  async function handleSafety(e: React.FormEvent) {
    e.preventDefault();
    if (!safetyTarget) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("inventory").update({ safety_stock: safetyValue }).eq("id", safetyTarget.id);
    setSafetyTarget(null);
    fetchData();
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name || inventory.find((i) => i.product_id === id)?.products.name || id.slice(0, 8);

  const filteredLogs = logProductFilter
    ? logs.filter((l) => l.product_id === logProductFilter)
    : logs;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">재고 관리</h1>
        <button
          onClick={() => setShowLog(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> 입출고 처리
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Warehouse size={16} className="text-primary" />
            <p className="text-sm text-text-muted">총 재고 수량</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{formatNumber(totalStock)}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5 cursor-pointer hover:border-yellow-400/30 transition-colors" onClick={() => setFilter(filter === "low" ? "all" : "low")}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-yellow-400" />
            <p className="text-sm text-text-muted">안전재고 미달</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{lowStockCount}건</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5 cursor-pointer hover:border-red-400/30 transition-colors" onClick={() => setFilter(filter === "zero" ? "all" : "zero")}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-400" />
            <p className="text-sm text-text-muted">재고 소진</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{zeroStockCount}건</p>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-4">
        {([["all", "전체"], ["low", "안전재고 미달"], ["zero", "재고 소진"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === key ? "bg-primary/10 text-primary ring-1 ring-primary" : "bg-bg-dark text-text-secondary hover:text-text-primary border border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 재고 목록 */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-dark">
                  <th className="px-4 py-3 text-left text-text-muted font-medium">상품</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">현재고</th>
                  <th className="px-4 py-3 text-right text-text-muted font-medium">안전재고</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">상태</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">최근 입고</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">최근 출고</th>
                  <th className="px-4 py-3 text-center text-text-muted font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const isLow = inv.current_stock > 0 && inv.current_stock <= inv.safety_stock;
                  const isZero = inv.current_stock === 0;

                  return (
                    <tr key={inv.id} className="border-b border-border hover:bg-bg-card-hover transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-text-primary font-medium">{inv.products.name}</p>
                        <p className="text-xs text-text-muted">{inv.products.category} · {inv.products.unit}</p>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${isZero ? "text-red-400" : isLow ? "text-yellow-400" : "text-text-primary"}`}>
                        {formatNumber(inv.current_stock)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">{formatNumber(inv.safety_stock)}</td>
                      <td className="px-4 py-3 text-center">
                        {isZero ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-400/10 text-red-400">소진</span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-400/10 text-yellow-400">부족</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400/10 text-emerald-400">정상</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted text-xs">
                        {inv.last_in_date ? new Date(inv.last_in_date).toLocaleDateString("ko-KR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted text-xs">
                        {inv.last_out_date ? new Date(inv.last_out_date).toLocaleDateString("ko-KR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setShowLog(true); setLogProductId(inv.product_id); setLogType("in"); }}
                            className="p-1.5 rounded-lg hover:bg-emerald-400/10 text-text-muted hover:text-emerald-400 transition-colors"
                            title="입고"
                          >
                            <ArrowDownCircle size={16} />
                          </button>
                          <button
                            onClick={() => { setShowLog(true); setLogProductId(inv.product_id); setLogType("out"); }}
                            className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                            title="출고"
                          >
                            <ArrowUpCircle size={16} />
                          </button>
                          <button
                            onClick={() => { setSafetyTarget(inv); setSafetyValue(inv.safety_stock); }}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                            title="안전재고 설정"
                          >
                            <Settings size={16} />
                          </button>
                          <button
                            onClick={() => setLogProductFilter(logProductFilter === inv.product_id ? null : inv.product_id)}
                            className={`p-1.5 rounded-lg transition-colors ${logProductFilter === inv.product_id ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text-primary hover:bg-bg-dark"}`}
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
                    <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                      {filter === "all" ? "등록된 재고가 없습니다." : "해당하는 항목이 없습니다."}
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
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {logProductFilter ? `${productName(logProductFilter)} 입출고 이력` : "최근 입출고 이력"}
            </h2>
            {logProductFilter && (
              <button onClick={() => setLogProductFilter(null)} className="text-sm text-text-muted hover:text-text-primary">전체 보기</button>
            )}
          </div>
          <div className="space-y-2">
            {filteredLogs.slice(0, 20).map((log) => {
              const t = INVENTORY_LOG_TYPES[log.type] || INVENTORY_LOG_TYPES.in;
              return (
                <div key={log.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-bg-dark transition-colors text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${t.color}`}>{t.label}</span>
                    <span className="text-text-primary">{productName(log.product_id)}</span>
                    {log.reason && <span className="text-text-muted text-xs">({log.reason})</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold ${t.color}`}>
                      {log.type === "in" ? "+" : log.type === "out" ? "-" : "="}{formatNumber(log.quantity)}
                    </span>
                    <span className="text-text-muted text-xs">
                      {new Date(log.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 입출고 모달 */}
      {showLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">입출고 처리</h2>
              <button onClick={() => setShowLog(false)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleLog} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">상품 <span className="text-red-400">*</span></label>
                  <select value={logProductId} onChange={(e) => setLogProductId(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary">
                    <option value="">선택</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">유형</label>
                  <select value={logType} onChange={(e) => setLogType(e.target.value as "in" | "out" | "adjust")} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary">
                    <option value="in">입고</option>
                    <option value="out">출고</option>
                    <option value="adjust">재고 조정</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">수량 <span className="text-red-400">*</span></label>
                  <input type="number" min={1} value={logQty} onChange={(e) => setLogQty(Number(e.target.value))} required className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">사유</label>
                  <input type="text" value={logReason} onChange={(e) => setLogReason(e.target.value)} placeholder="예: 거래처 납품, 반품 등" className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowLog(false)} className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors">처리</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 안전재고 설정 모달 */}
      {safetyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card border border-border rounded-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">안전재고 설정</h2>
              <button onClick={() => setSafetyTarget(null)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleSafety} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">상품명</label>
                  <p className="px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary">{safetyTarget.products.name}</p>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">안전재고 수량</label>
                  <input type="number" min={0} value={safetyValue} onChange={(e) => setSafetyValue(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setSafetyTarget(null)} className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
