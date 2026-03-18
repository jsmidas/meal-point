"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product, Company, CompanyPrice } from "@/lib/supabase/types";
import { formatNumber } from "@/lib/utils";
import { Save, X, Edit2 } from "lucide-react";

export default function PriceTablePage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyPrices, setCompanyPrices] = useState<CompanyPrice[]>([]);
  const [loading, setLoading] = useState(true);

  // 편집 모드: company_id
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  // 편집 중인 단가 맵: { product_id: price }
  const [editPrices, setEditPrices] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const [prodRes, compRes, priceRes] = await Promise.all([
      db.from("products").select("*").eq("is_active", true).order("category").order("name"),
      db.from("companies").select("*").eq("is_active", true).order("name"),
      db.from("company_prices").select("*"),
    ]);

    setProducts(prodRes.data || []);
    setCompanies(compRes.data || []);
    setCompanyPrices(priceRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 거래처만 (customer 또는 both)
  const customers = useMemo(() => {
    return companies.filter((c) => {
      const ct = (c as any).company_type || "customer";
      return ct === "customer" || ct === "both";
    });
  }, [companies]);

  // 단가 맵: company_id -> product_id -> price
  const priceMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const cp of companyPrices) {
      if (!map[cp.company_id]) map[cp.company_id] = {};
      map[cp.company_id][cp.product_id] = cp.custom_price;
    }
    return map;
  }, [companyPrices]);

  function getPrice(companyId: string, productId: string): number | null {
    return priceMap[companyId]?.[productId] ?? null;
  }

  function startEditing(companyId: string) {
    const prices: Record<string, number> = {};
    for (const p of products) {
      const existing = getPrice(companyId, p.id);
      prices[p.id] = existing ?? p.selling_price;
    }
    setEditPrices(prices);
    setEditingCompanyId(companyId);
  }

  function cancelEditing() {
    setEditingCompanyId(null);
    setEditPrices({});
  }

  async function handleSave() {
    if (!editingCompanyId) return;
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    for (const product of products) {
      const price = editPrices[product.id] ?? 0;
      const existing = companyPrices.find(
        (cp) => cp.company_id === editingCompanyId && cp.product_id === product.id
      );

      if (existing) {
        if (existing.custom_price !== price) {
          await db.from("company_prices").update({ custom_price: price }).eq("id", existing.id);
        }
      } else if (price > 0) {
        await db.from("company_prices").insert({
          company_id: editingCompanyId,
          product_id: product.id,
          custom_price: price,
        });
      }
    }

    setSaving(false);
    cancelEditing();
    fetchData();
  }

  const categoryLabels: Record<string, string> = {
    inner: "내피",
    outer: "외피",
    "내피": "내피",
    "외피": "외피",
    heater: "발열제",
    film: "필름",
    set: "세트",
  };

  // 카테고리별 그룹핑
  const categoryGroups = useMemo(() => {
    const groups: { category: string; label: string; items: Product[] }[] = [];
    const catMap = new Map<string, Product[]>();
    for (const p of products) {
      const cat = p.category;
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(p);
    }
    for (const [cat, items] of catMap) {
      groups.push({ category: cat, label: categoryLabels[cat] || cat, items });
    }
    return groups;
  }, [products]);

  if (loading) {
    return <div className="text-center py-20 text-text-muted">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">업체별 단가표</h1>
        <p className="text-sm text-text-muted">
          {customers.length}개 거래처 · {products.length}개 상품
        </p>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mb-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary/20 inline-block" /> 개별 단가 설정됨
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-bg-dark inline-block border border-border" /> 기본 판매가 적용
        </span>
      </div>

      {/* 단가표 */}
      <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* 카테고리 헤더 */}
              <tr className="border-b border-border bg-bg-dark">
                <th className="px-4 py-2 text-left text-text-muted font-medium sticky left-0 bg-bg-dark z-10 min-w-[160px]" rowSpan={2}>
                  거래처
                </th>
                <th className="px-2 py-1 text-center text-text-muted font-medium sticky left-[160px] bg-bg-dark z-10" rowSpan={2}>
                  관리
                </th>
                {categoryGroups.map((g) => (
                  <th
                    key={g.category}
                    colSpan={g.items.length}
                    className="px-2 py-2 text-center text-text-muted font-semibold border-l border-border"
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              {/* 상품명 헤더 */}
              <tr className="border-b border-border bg-bg-dark">
                {products.map((p, i) => {
                  const isFirstInCategory = i === 0 || products[i - 1].category !== p.category;
                  return (
                    <th
                      key={p.id}
                      className={`px-2 py-2 text-center text-text-secondary font-medium min-w-[100px] ${
                        isFirstInCategory ? "border-l border-border" : ""
                      }`}
                    >
                      <div className="text-xs leading-tight">
                        {p.name}
                        {(p.box_quantity ?? 1) > 1 && (
                          <div className="text-text-muted font-normal mt-0.5">
                            {p.box_quantity}개/박스
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
              {/* 기본 판매가 행 */}
              <tr className="border-b-2 border-primary/30 bg-primary/5">
                <td className="px-4 py-2 text-text-primary font-semibold sticky left-0 bg-primary/5 z-10">
                  기본 판매가
                </td>
                <td className="px-2 py-2 sticky left-[160px] bg-primary/5 z-10" />
                {products.map((p, i) => {
                  const isFirstInCategory = i === 0 || products[i - 1].category !== p.category;
                  return (
                    <td
                      key={p.id}
                      className={`px-2 py-2 text-center text-primary font-bold ${
                        isFirstInCategory ? "border-l border-border" : ""
                      }`}
                    >
                      {p.selling_price > 0 ? formatNumber(p.selling_price) : "-"}
                      {(p.box_quantity ?? 1) > 1 && p.selling_price > 0 && (
                        <div className="text-xs text-text-muted font-normal">
                          박스 {formatNumber(p.selling_price * p.box_quantity)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={products.length + 2} className="px-4 py-12 text-center text-text-muted">
                    등록된 거래처가 없습니다.
                  </td>
                </tr>
              ) : (
                customers.map((company) => {
                  const isEditing = editingCompanyId === company.id;

                  return (
                    <tr
                      key={company.id}
                      className={`border-b border-border transition-colors ${
                        isEditing ? "bg-primary/5" : "hover:bg-bg-card-hover"
                      }`}
                    >
                      <td className="px-4 py-3 text-text-primary font-medium sticky left-0 bg-inherit z-10">
                        {company.name}
                      </td>
                      <td className="px-2 py-3 sticky left-[160px] bg-inherit z-10">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={handleSave}
                              disabled={saving}
                              className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                              title="저장"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary transition-colors"
                              title="취소"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(company.id)}
                            className="p-1.5 rounded-lg hover:bg-bg-card text-text-muted hover:text-primary transition-colors"
                            title="단가 수정"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </td>
                      {products.map((p, i) => {
                        const isFirstInCategory = i === 0 || products[i - 1].category !== p.category;
                        const customPrice = getPrice(company.id, p.id);
                        const hasCustom = customPrice !== null;
                        const displayPrice = customPrice ?? p.selling_price;

                        if (isEditing) {
                          return (
                            <td
                              key={p.id}
                              className={`px-1 py-1 text-center ${
                                isFirstInCategory ? "border-l border-border" : ""
                              }`}
                            >
                              <input
                                type="number"
                                min={0}
                                value={editPrices[p.id] ?? 0}
                                onChange={(e) =>
                                  setEditPrices({
                                    ...editPrices,
                                    [p.id]: Number(e.target.value),
                                  })
                                }
                                aria-label={`${company.name} - ${p.name} 단가`}
                                className="w-full px-2 py-1.5 text-center text-sm rounded-lg border border-primary/30 bg-bg-dark text-text-primary focus:outline-none focus:border-primary"
                              />
                              {(p.box_quantity ?? 1) > 1 && (editPrices[p.id] ?? 0) > 0 && (
                                <div className="text-xs text-text-muted mt-0.5">
                                  박스 {formatNumber((editPrices[p.id] ?? 0) * p.box_quantity)}
                                </div>
                              )}
                            </td>
                          );
                        }

                        return (
                          <td
                            key={p.id}
                            className={`px-2 py-3 text-center ${
                              isFirstInCategory ? "border-l border-border" : ""
                            } ${hasCustom ? "bg-primary/5" : ""}`}
                          >
                            <span
                              className={`font-medium ${
                                hasCustom ? "text-primary" : "text-text-secondary"
                              }`}
                            >
                              {displayPrice > 0 ? formatNumber(displayPrice) : "-"}
                            </span>
                            {(p.box_quantity ?? 1) > 1 && displayPrice > 0 && (
                              <div className="text-xs text-text-muted">
                                박스 {formatNumber(displayPrice * p.box_quantity)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
