"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OrderWithItems } from "@/lib/supabase/types";
import { ORDER_STATUS, formatNumber, formatDate } from "@/lib/utils";
import { dbUpdate, dbDelete } from "@/lib/db";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";
import Link from "next/link";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchOrder() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("orders") as any)
      .select("*, companies(*), order_items(*)")
      .eq("id", id)
      .single();
    setOrder(data as OrderWithItems | null);
    setLoading(false);
  }

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus(status: string) {
    await dbUpdate("orders", { status }, { id });
    fetchOrder();
  }

  async function handleDelete() {
    if (!confirm("이 주문을 삭제하시겠습니까?")) return;
    await dbDelete("orders", { id });
    router.push("/admin/orders");
  }

  if (loading) {
    return <div className="text-center py-20 text-text-muted">로딩 중...</div>;
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-text-muted">
        주문을 찾을 수 없습니다.
      </div>
    );
  }

  const st = ORDER_STATUS[order.status] || ORDER_STATUS.pending;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/orders"
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">
            {order.order_number}
          </h1>
          <p className="text-sm text-text-secondary">{order.companies.name}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${st.color}`}
        >
          {st.label}
        </span>
      </div>

      {/* Info Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">주문일</p>
          <p className="text-text-primary font-medium">
            {formatDate(order.order_date)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">총 금액</p>
          <p className="text-text-primary font-bold text-lg">
            {formatNumber(order.total_amount)}원
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">항목 수</p>
          <p className="text-text-primary font-medium">
            {order.order_items.length}개
          </p>
        </div>
      </div>

      {/* Status Actions */}
      <div className="rounded-2xl border border-border bg-bg-card p-6 mb-6">
        <h2 className="text-sm font-medium text-text-secondary mb-3">
          상태 변경
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ORDER_STATUS).map(([key, { label, color }]) => (
            <button
              key={key}
              onClick={() => updateStatus(key)}
              disabled={order.status === key}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                order.status === key
                  ? `${color} ring-2 ring-current`
                  : "bg-bg-dark text-text-secondary hover:text-text-primary border border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Order Items Table */}
      <div className="rounded-2xl border border-border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-card">
              <th className="text-left px-4 py-3 text-text-secondary font-medium">
                상품명
              </th>
              <th className="text-left px-4 py-3 text-text-secondary font-medium">
                단위
              </th>
              <th className="text-right px-4 py-3 text-text-secondary font-medium">
                수량
              </th>
              <th className="text-right px-4 py-3 text-text-secondary font-medium">
                단가
              </th>
              <th className="text-right px-4 py-3 text-text-secondary font-medium">
                소계
              </th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border hover:bg-bg-card-hover transition-colors"
              >
                <td className="px-4 py-3 text-text-primary font-medium">
                  {item.product_name}
                </td>
                <td className="px-4 py-3 text-text-secondary">{item.unit}</td>
                <td className="px-4 py-3 text-text-primary text-right">
                  {formatNumber(item.quantity)}
                </td>
                <td className="px-4 py-3 text-text-secondary text-right">
                  {formatNumber(item.unit_price)}원
                </td>
                <td className="px-4 py-3 text-text-primary text-right font-medium">
                  {formatNumber(item.amount)}원
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-bg-card">
              <td
                colSpan={4}
                className="px-4 py-3 text-right text-text-secondary font-medium"
              >
                합계
              </td>
              <td className="px-4 py-3 text-right text-text-primary font-bold text-lg">
                {formatNumber(order.total_amount)}원
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="rounded-2xl border border-border bg-bg-card p-6 mb-6">
          <h2 className="text-sm font-medium text-text-secondary mb-2">메모</h2>
          <p className="text-text-primary whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/admin/statements/new?orderId=${order.id}`}
          className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-dark transition-colors"
        >
          <FileText size={18} /> 거래명세서 생성
        </Link>
        <button
          onClick={handleDelete}
          className="px-6 py-3 rounded-xl border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
