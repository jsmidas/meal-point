"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/supabase/types";
import { Plus, Search, Edit2, Trash2, Package, FileImage } from "lucide-react";
import ProductModal from "./ProductModal";
import Link from "next/link";

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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);

  const supabase = createClient();

  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await supabase.from("products").delete().eq("id", id);
    fetchProducts();
  }

  const filtered = products.filter((p) => {
    const matchSearch = p.name.includes(search);
    const matchCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">상품 관리</h1>
        <button
          onClick={() => {
            setEditTarget(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> 상품 추가
        </button>
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary focus:outline-none focus:border-primary transition-colors"
        >
          <option value="all">전체 카테고리</option>
          {Object.entries(categoryLabels).map(([key, label]) => (
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
          <Package size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">
            {search || categoryFilter !== "all"
              ? "검색 결과가 없습니다."
              : "등록된 상품이 없습니다."}
          </p>
          {!search && categoryFilter === "all" && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 text-sm text-primary hover:underline"
            >
              첫 상품을 등록해보세요
            </button>
          )}
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
                <th className="text-left px-4 py-3 text-text-secondary font-medium hidden md:table-cell">
                  단위
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium hidden md:table-cell">
                  박스당 수량
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium hidden md:table-cell">
                  EA 원가
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">
                  EA 판매가
                </th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">
                  박스 단가
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
              {filtered.map((product) => (
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
                        categoryColors[product.category] || "bg-bg-card text-text-muted"
                      }`}
                    >
                      {categoryLabels[product.category] || product.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                    {product.unit}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-right hidden md:table-cell">
                    {(product.box_quantity ?? 1) > 1 ? `${product.box_quantity}개` : '-'}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-right hidden md:table-cell">
                    {product.cost_price.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-text-primary text-right font-medium">
                    {product.selling_price.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {(product.box_quantity ?? 1) > 1
                      ? <span className="text-amber-400">{(product.selling_price * product.box_quantity).toLocaleString()}원</span>
                      : <span className="text-text-muted">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        product.is_active
                          ? "bg-emerald-400/10 text-emerald-400"
                          : "bg-red-400/10 text-red-400"
                      }`}
                    >
                      {product.is_active ? "판매중" : "중단"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/pages/${product.id}`}
                        className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-accent transition-colors"
                        title="상세페이지 편집"
                      >
                        <FileImage size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setEditTarget(product);
                          setModalOpen(true);
                        }}
                        className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-primary transition-colors"
                        aria-label="수정"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
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

      {modalOpen && (
        <ProductModal
          product={editTarget}
          onClose={() => {
            setModalOpen(false);
            setEditTarget(null);
          }}
          onSaved={fetchProducts}
        />
      )}
    </div>
  );
}
