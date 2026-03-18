"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QuoteWithCompany } from "@/lib/supabase/types";
import { Plus, Search, Eye, ClipboardList } from "lucide-react";
import Link from "next/link";
import { QUOTE_STATUS, formatNumber, formatDate } from "@/lib/utils";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const supabase = createClient();

  useEffect(() => {
    (async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("quotes") as any)
        .select("*, companies(*)")
        .order("created_at", { ascending: false });
      setQuotes((data as QuoteWithCompany[]) || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = quotes.filter((q) => {
    const companyName = q.companies?.name || q.recipient_name || "";
    const matchSearch =
      q.quote_number.includes(search) || companyName.includes(search);
    const matchStatus = statusFilter === "all" || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">견적서</h1>
        <Link
          href="/admin/quotes/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> 새 견적서
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="견적번호, 거래처 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          title="상태 필터"
          className="px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary focus:outline-none focus:border-primary transition-colors"
        >
          <option value="all">전체 상태</option>
          {Object.entries(QUOTE_STATUS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">
            {search || statusFilter !== "all" ? "검색 결과가 없습니다." : "작성된 견적서가 없습니다."}
          </p>
          {!search && statusFilter === "all" && (
            <Link href="/admin/quotes/new" className="mt-4 inline-block text-sm text-primary hover:underline">
              첫 견적서를 작성해보세요
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left px-4 py-3 text-text-secondary font-medium">견적번호</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">거래처</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium hidden md:table-cell">작성일</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium hidden lg:table-cell">유효기간</th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">합계</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">상태</th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const st = QUOTE_STATUS[q.status] || QUOTE_STATUS.draft;
                return (
                  <tr key={q.id} className="border-b border-border hover:bg-bg-card-hover transition-colors">
                    <td className="px-4 py-3 text-text-primary font-mono text-xs">{q.quote_number}</td>
                    <td className="px-4 py-3 text-text-primary font-medium">
                      {q.companies?.name || q.recipient_name || "—"}
                      {!q.companies && <span className="ml-1 text-xs text-yellow-500">(직접)</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{formatDate(q.quote_date)}</td>
                    <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">
                      {q.valid_until ? formatDate(q.valid_until) : "—"}
                    </td>
                    <td className="px-4 py-3 text-text-primary text-right font-medium">{formatNumber(q.total_amount)}원</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/quotes/${q.id}`} className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-primary transition-colors inline-flex">
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
