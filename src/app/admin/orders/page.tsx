"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderWithCompany } from "@/lib/supabase/types";
import { Plus, Search, Eye, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { ORDER_STATUS, formatNumber, formatDate } from "@/lib/utils";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const supabase = createClient();

  async function fetchOrders() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("orders") as any)
      .select("*, companies(*)")
      .order("created_at", { ascending: false });
    setOrders((data as OrderWithCompany[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.order_number.includes(search) ||
      o.companies.name.includes(search);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">주문 관리</h1>
        <Link
          href="/admin/orders/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> 새 주문
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="주문번호, 거래처 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary focus:outline-none focus:border-primary transition-colors"
        >
          <option value="all">전체 상태</option>
          {Object.entries(ORDER_STATUS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingCart size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">
            {search || statusFilter !== "all"
              ? "검색 결과가 없습니다."
              : "등록된 주문이 없습니다."}
          </p>
          {!search && statusFilter === "all" && (
            <Link
              href="/admin/orders/new"
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              첫 주문을 등록해보세요
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  주문번호
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  거래처
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium hidden md:table-cell">
                  주문일
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">
                  금액
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  상태
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const st = ORDER_STATUS[order.status] || ORDER_STATUS.pending;
                return (
                  <tr
                    key={order.id}
                    className="border-b border-border hover:bg-bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 text-text-primary font-mono text-xs">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 text-text-primary font-medium">
                      {order.companies.name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                      {formatDate(order.order_date)}
                    </td>
                    <td className="px-4 py-3 text-text-primary text-right font-medium">
                      {formatNumber(order.total_amount)}원
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-primary transition-colors inline-flex"
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
