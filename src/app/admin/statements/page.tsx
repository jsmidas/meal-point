"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StatementWithCompany } from "@/lib/supabase/types";
import { Plus, Search, Eye, FileText } from "lucide-react";
import Link from "next/link";
import { formatNumber, formatDate } from "@/lib/utils";

export default function StatementsPage() {
  const [statements, setStatements] = useState<StatementWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const supabase = createClient();

  async function fetchStatements() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("statements") as any)
      .select("*, companies(*)")
      .order("created_at", { ascending: false });
    setStatements((data as StatementWithCompany[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchStatements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = statements.filter(
    (s) =>
      s.statement_number.includes(search) ||
      s.companies.name.includes(search),
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">거래명세서</h1>
        <Link
          href="/admin/statements/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> 새 거래명세서
        </Link>
      </div>

      <div className="relative mb-6">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          placeholder="명세서번호, 거래처 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">
            {search
              ? "검색 결과가 없습니다."
              : "작성된 거래명세서가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  명세서번호
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  거래처
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium hidden md:table-cell">
                  작성일
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium hidden md:table-cell">
                  공급가액
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium hidden md:table-cell">
                  세액
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">
                  합계
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border hover:bg-bg-card-hover transition-colors"
                >
                  <td className="px-4 py-3 text-text-primary font-mono text-xs">
                    {s.statement_number}
                  </td>
                  <td className="px-4 py-3 text-text-primary font-medium">
                    {s.companies.name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                    {formatDate(s.statement_date)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-right hidden md:table-cell">
                    {formatNumber(s.supply_amount)}원
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-right hidden md:table-cell">
                    {formatNumber(s.tax_amount)}원
                  </td>
                  <td className="px-4 py-3 text-text-primary text-right font-medium">
                    {formatNumber(s.total_amount)}원
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/statements/${s.id}`}
                      className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-primary transition-colors inline-flex"
                    >
                      <Eye size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
