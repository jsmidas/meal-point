"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/supabase/types";
import {
  Search,
  Eye,
  Edit2,
  Plus,
  FileImage,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

type PageStatus = {
  product_id: string;
  is_published: boolean;
  updated_at: string;
};

const categoryLabels: Record<string, string> = {
  inner: "내피",
  outer: "외피",
  heater: "발열제",
  film: "필름",
  set: "세트",
};

const categoryColors: Record<string, string> = {
  inner: "bg-primary/10 text-primary",
  outer: "bg-accent/10 text-accent",
  heater: "bg-red-400/10 text-red-400",
  film: "bg-emerald-400/10 text-emerald-400",
  set: "bg-blue-400/10 text-blue-400",
};

export default function PagesManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pageMap, setPageMap] = useState<Record<string, PageStatus>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "created" | "none" | "published">("all");

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const { data: prods } = await db
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: pages } = await db
        .from("product_pages")
        .select("product_id, is_published, updated_at");

      const map: Record<string, PageStatus> = {};
      if (pages) {
        for (const p of pages) {
          map[p.product_id] = p;
        }
      }

      setProducts(prods || []);
      setPageMap(map);
      setLoading(false);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const hasPage = !!pageMap[p.id];
    const isPublished = pageMap[p.id]?.is_published;

    if (filter === "created") return matchSearch && hasPage;
    if (filter === "none") return matchSearch && !hasPage;
    if (filter === "published") return matchSearch && isPublished;
    return matchSearch;
  });

  const totalProducts = products.length;
  const createdCount = products.filter((p) => pageMap[p.id]).length;
  const publishedCount = products.filter((p) => pageMap[p.id]?.is_published).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">상세페이지 관리</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">전체 상품</p>
          <p className="text-2xl font-bold text-text-primary">{totalProducts}</p>
        </div>
        <div className="rounded-2xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">페이지 생성됨</p>
          <p className="text-2xl font-bold text-accent">{createdCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-bg-card p-4">
          <p className="text-xs text-text-muted mb-1">공개 중</p>
          <p className="text-2xl font-bold text-emerald-400">{publishedCount}</p>
        </div>
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
            placeholder="상품명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          aria-label="상태 필터"
          className="px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary focus:outline-none focus:border-primary transition-colors"
        >
          <option value="all">전체</option>
          <option value="created">페이지 생성됨</option>
          <option value="published">공개 중</option>
          <option value="none">미생성</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-text-muted">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileImage size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">
            {search || filter !== "all"
              ? "검색 결과가 없습니다."
              : "등록된 상품이 없습니다. 상품을 먼저 등록해주세요."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  상품명
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">
                  카테고리
                </th>
                <th className="text-center px-4 py-3 text-text-secondary font-medium">
                  페이지 상태
                </th>
                <th className="text-center px-4 py-3 text-text-secondary font-medium">
                  공개 여부
                </th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium hidden md:table-cell">
                  최종 수정
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const pageStatus = pageMap[product.id];
                const hasPage = !!pageStatus;

                return (
                  <tr
                    key={product.id}
                    className="border-b border-border hover:bg-bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 text-text-primary font-medium">
                      {product.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          categoryColors[product.category] ||
                          "bg-bg-card text-text-muted"
                        }`}
                      >
                        {categoryLabels[product.category] || product.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          hasPage
                            ? "bg-accent/10 text-accent"
                            : "bg-bg-card text-text-muted"
                        }`}
                      >
                        {hasPage ? "생성됨" : "미생성"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          pageStatus?.is_published
                            ? "bg-emerald-400/10 text-emerald-400"
                            : "bg-red-400/10 text-red-400"
                        }`}
                      >
                        {pageStatus?.is_published ? "공개" : "비공개"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-sm hidden md:table-cell">
                      {pageStatus?.updated_at
                        ? new Date(pageStatus.updated_at).toLocaleDateString(
                            "ko-KR"
                          )
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/pages/${product.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          {hasPage ? (
                            <>
                              <Edit2 size={13} /> 편집
                            </>
                          ) : (
                            <>
                              <Plus size={13} /> 생성
                            </>
                          )}
                        </Link>
                        {hasPage && pageStatus?.is_published && (
                          <Link
                            href={`/products/${product.id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-bg-card transition-colors"
                            title="공개 페이지 보기"
                          >
                            <ExternalLink size={13} />
                          </Link>
                        )}
                      </div>
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
