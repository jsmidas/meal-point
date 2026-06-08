"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, PlusCircle, ChevronDown, Pencil, X } from "lucide-react";
import { ORDER_STATUS, formatNumber, formatDate } from "@/lib/utils";

interface PortalOrderItem {
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}
interface PortalOrder {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total_amount: number;
  notes: string | null;
  source: string;
  created_at: string;
  order_items: PortalOrderItem[];
}

export default function PortalHomePage() {
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/portal/orders");
    const data = await res.json();
    if (data.ok) setOrders(data.orders);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function cancelOrder(id: string) {
    if (!confirm("이 발주를 취소하시겠습니까?")) return;
    setCancelling(id);
    const res = await fetch(`/api/portal/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json();
    setCancelling(null);
    if (!data.ok) {
      alert(data.error || "취소에 실패했습니다.");
      return;
    }
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold text-text-primary">발주 내역</h1>
        <Link
          href="/portal/order/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <PlusCircle size={18} /> 새 발주
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-text-muted">불러오는 중...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary mb-4">아직 발주 내역이 없습니다.</p>
          <Link
            href="/portal/order/new"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <PlusCircle size={16} /> 첫 발주를 넣어보세요
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
            const open = expanded === o.id;
            return (
              <div key={o.id} className="rounded-2xl border border-border bg-bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : o.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-bg-card-hover transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text-muted">{o.order_number}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="text-sm text-text-secondary mt-1">
                      {formatDate(o.order_date)} · {o.order_items?.length || 0}개 품목
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-text-primary">
                      {formatNumber(o.total_amount)}원
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border px-4 py-3 bg-bg-dark/30">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-text-muted">
                          <th className="text-left font-medium pb-2">상품</th>
                          <th className="text-right font-medium pb-2">수량</th>
                          <th className="text-right font-medium pb-2">단가</th>
                          <th className="text-right font-medium pb-2">금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.order_items?.map((it, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="py-2 text-text-primary">{it.product_name}</td>
                            <td className="py-2 text-right text-text-secondary">
                              {it.quantity} {it.unit}
                            </td>
                            <td className="py-2 text-right text-text-secondary">
                              {formatNumber(it.unit_price)}
                            </td>
                            <td className="py-2 text-right text-text-primary font-medium">
                              {formatNumber(it.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {o.notes && (
                      <p className="mt-3 text-xs text-text-muted">메모: {o.notes}</p>
                    )}
                    {o.status === "pending" && (
                      <div className="mt-3 pt-3 border-t border-border/50 flex justify-end gap-2">
                        <Link
                          href={`/portal/order/new?edit=${o.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-text-secondary text-xs font-medium hover:bg-bg-card-hover transition-colors"
                        >
                          <Pencil size={14} /> 수정
                        </Link>
                        <button
                          type="button"
                          onClick={() => cancelOrder(o.id)}
                          disabled={cancelling === o.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400/30 text-red-400 text-xs font-medium hover:bg-red-400/10 transition-colors disabled:opacity-50"
                        >
                          <X size={14} /> {cancelling === o.id ? "취소 중..." : "발주 취소"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
