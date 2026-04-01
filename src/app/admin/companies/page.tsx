"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbDelete } from "@/lib/db";
import type { Company } from "@/lib/supabase/types";
import { Plus, Search, Edit2, Trash2, Building2 } from "lucide-react";
import CompanyModal from "./CompanyModal";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);

  const supabase = createClient();

  async function fetchCompanies() {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    setCompanies(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await dbDelete("companies", { id });
    fetchCompanies();
  }

  const filtered = companies.filter((c) => {
    const matchSearch =
      c.name.includes(search) ||
      c.biz_number.includes(search) ||
      c.ceo_name.includes(search);
    const ct = (c as any).company_type || "customer";
    const matchType =
      typeFilter === "all" ||
      ct === typeFilter ||
      (ct === "both" && (typeFilter === "customer" || typeFilter === "supplier"));
    return matchSearch && matchType;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">거래처 관리</h1>
        <button
          onClick={() => {
            setEditTarget(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> 거래처 추가
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          placeholder="상호명, 사업자번호, 대표자 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* 유형 필터 */}
      <div className="flex gap-2 mb-6">
        {[
          { value: "all", label: "전체" },
          { value: "customer", label: "판매처" },
          { value: "supplier", label: "매입처" },
          { value: "both", label: "양쪽" },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              typeFilter === t.value
                ? "bg-primary text-bg-dark"
                : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Building2 size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">
            {search ? "검색 결과가 없습니다." : "등록된 거래처가 없습니다."}
          </p>
          {!search && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 text-sm text-primary hover:underline"
            >
              첫 거래처를 등록해보세요
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  상호명
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  대표자
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium hidden md:table-cell">
                  사업자번호
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium hidden lg:table-cell">
                  연락처
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  유형
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
              {filtered.map((company) => (
                <tr
                  key={company.id}
                  className="border-b border-border hover:bg-bg-card-hover transition-colors"
                >
                  <td className="px-4 py-3 text-text-primary font-medium">
                    {company.name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {company.ceo_name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                    {company.biz_number}
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">
                    {company.phone || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const ct = (company as any).company_type || "customer";
                      const styles: Record<string, string> = {
                        customer: "bg-blue-400/10 text-blue-400",
                        supplier: "bg-emerald-400/10 text-emerald-400",
                        both: "bg-purple-400/10 text-purple-400",
                      };
                      const labels: Record<string, string> = {
                        customer: "판매처",
                        supplier: "매입처",
                        both: "양쪽",
                      };
                      return (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[ct] || styles.customer}`}>
                          {labels[ct] || "판매처"}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        company.is_active
                          ? "bg-emerald-400/10 text-emerald-400"
                          : "bg-red-400/10 text-red-400"
                      }`}
                    >
                      {company.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditTarget(company);
                          setModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-primary transition-colors"
                        aria-label="수정"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(company.id)}
                        className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-red-400 transition-colors"
                        aria-label="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <CompanyModal
          company={editTarget}
          onClose={() => {
            setModalOpen(false);
            setEditTarget(null);
          }}
          onSaved={fetchCompanies}
        />
      )}
    </div>
  );
}
