"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company, Product, CompanyPrice } from "@/lib/supabase/types";
import { formatNumber } from "@/lib/utils";
import { Save, Check, Building2, RotateCcw } from "lucide-react";

type DirtyMap = Record<string, number>; // `${companyId}_${productId}` → new price

const CATEGORY_LABELS: Record<string, string> = {
  inner: "내피", outer: "외피", "내피": "내피", "외피": "외피",
  heater: "발열제", film: "필름", set: "세트",
};

export default function PricesPage() {
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyPrices, setCompanyPrices] = useState<CompanyPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<DirtyMap>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [cRes, pRes, prRes] = await Promise.all([
      db.from("companies").select("*").eq("is_active", true).order("name"),
      db.from("products").select("*").eq("is_active", true).order("category").order("name"),
      db.from("company_prices").select("*"),
    ]);
    setCompanies(cRes.data || []);
    setProducts(pRes.data || []);
    setCompanyPrices(prRes.data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // 거래처만 (customer / both)
  const customers = useMemo(() => {
    return companies.filter((c) => {
      const ct = (c as any).company_type || "customer";
      return ct === "customer" || ct === "both";
    });
  }, [companies]);

  // 단가 맵: `companyId_productId` → price
  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cp of companyPrices) {
      map[`${cp.company_id}_${cp.product_id}`] = cp.custom_price;
    }
    return map;
  }, [companyPrices]);

  // 카테고리별 그룹
  const categoryGroups = useMemo(() => {
    const groups: { category: string; label: string; items: Product[] }[] = [];
    const catMap = new Map<string, Product[]>();
    for (const p of products) {
      if (!catMap.has(p.category)) catMap.set(p.category, []);
      catMap.get(p.category)!.push(p);
    }
    for (const [cat, items] of catMap) {
      groups.push({ category: cat, label: CATEGORY_LABELS[cat] || cat, items });
    }
    return groups;
  }, [products]);

  function getDisplayPrice(companyId: string, productId: string): string {
    const key = `${companyId}_${productId}`;
    if (key in dirty) return dirty[key] === 0 ? "" : String(dirty[key]);
    const saved = priceMap[key];
    if (saved !== undefined) return String(saved);
    return "";
  }

  function getEffectivePrice(companyId: string, productId: string): number {
    const key = `${companyId}_${productId}`;
    if (key in dirty) return dirty[key];
    return priceMap[key] ?? 0;
  }

  function hasCustomPrice(companyId: string, productId: string): boolean {
    const key = `${companyId}_${productId}`;
    return key in dirty || key in priceMap;
  }

  function handlePriceChange(companyId: string, productId: string, value: string) {
    const key = `${companyId}_${productId}`;
    const num = value === "" ? 0 : Number(value);
    setDirty((prev) => ({ ...prev, [key]: num }));
    setSaved(false);
  }

  function handleReset() {
    setDirty({});
    setSaved(false);
  }

  async function handleSave() {
    const keys = Object.keys(dirty);
    if (keys.length === 0) return;
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // 삭제 대상 (0원으로 변경된 것 중 기존에 저장된 것)
    const toDelete = keys.filter((k) => dirty[k] === 0 && k in priceMap);
    // upsert 대상 (0보다 큰 것)
    const toUpsert = keys
      .filter((k) => dirty[k] > 0)
      .map((k) => {
        // UUID는 하이픈(-) 포함, 구분자는 언더스코어(_)
        const sepIdx = k.indexOf("_");
        const companyId = k.substring(0, sepIdx);
        const productId = k.substring(sepIdx + 1);
        return { company_id: companyId, product_id: productId, custom_price: dirty[k] };
      });

    let hasError = false;

    // 기존 레코드를 먼저 삭제 후 insert (upsert 대신)
    for (const item of toUpsert) {
      await db.from("company_prices").delete()
        .eq("company_id", item.company_id)
        .eq("product_id", item.product_id);
      const { error } = await db.from("company_prices").insert(item);
      if (error) {
        console.error("단가 저장 실패:", error, item);
        hasError = true;
      }
    }

    for (const k of toDelete) {
      const sepIdx = k.indexOf("_");
      const companyId = k.substring(0, sepIdx);
      const productId = k.substring(sepIdx + 1);
      await db.from("company_prices").delete().eq("company_id", companyId).eq("product_id", productId);
    }

    if (hasError) {
      alert("일부 단가 저장에 실패했습니다. 콘솔을 확인해주세요.");
    }

    // 데이터 다시 로드 후 dirty 초기화
    await load();
    setDirty({});
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  const dirtyCount = Object.keys(dirty).length;

  if (loading) {
    return <div className="text-center py-20 text-text-muted">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">단가 관리</h1>
          <p className="text-sm text-text-muted mt-1">
            {customers.length}개 거래처 · {products.length}개 상품 — 셀을 직접 수정하고 저장하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors"
            >
              <RotateCcw size={16} /> 되돌리기
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || dirtyCount === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saved ? <Check size={18} /> : <Save size={18} />}
            {saving ? "저장 중..." : saved ? "저장 완료!" : dirtyCount > 0 ? `저장 (${dirtyCount}건)` : "저장"}
          </button>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-5 mb-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary/20 inline-block border border-primary/30" /> 업체별 단가 설정
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-bg-dark inline-block border border-border" /> 기본 판매가 적용
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-yellow-500/20 inline-block border border-yellow-500/30" /> 수정됨 (미저장)
        </span>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <Building2 size={48} className="mx-auto mb-4 opacity-50" />
          <p>등록된 판매처가 없습니다.</p>
          <p className="text-sm mt-1">거래처 관리에서 판매처를 먼저 등록해주세요.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                {/* 카테고리 헤더 */}
                <tr className="border-b border-border bg-bg-dark">
                  <th
                    className="px-4 py-2 text-left text-text-muted font-medium sticky left-0 bg-bg-dark z-20 min-w-[140px]"
                    rowSpan={2}
                  >
                    거래처
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
                    const isFirst = i === 0 || products[i - 1].category !== p.category;
                    return (
                      <th
                        key={p.id}
                        className={`px-1 py-2 text-center text-text-secondary font-medium min-w-[90px] ${
                          isFirst ? "border-l border-border" : ""
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
                  <td className="px-4 py-2 text-text-primary font-semibold sticky left-0 bg-primary/5 z-20">
                    기본 판매가
                  </td>
                  {products.map((p, i) => {
                    const isFirst = i === 0 || products[i - 1].category !== p.category;
                    return (
                      <td
                        key={p.id}
                        className={`px-2 py-2 text-center text-primary font-bold ${
                          isFirst ? "border-l border-border" : ""
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
                {customers.map((company) => (
                  <tr
                    key={company.id}
                    className="border-b border-border hover:bg-bg-card-hover/50 transition-colors"
                  >
                    <td className="px-4 py-2 text-text-primary font-medium sticky left-0 bg-bg-card z-10 border-r border-border">
                      <div className="truncate max-w-[130px]" title={company.name}>
                        {company.name}
                      </div>
                    </td>
                    {products.map((p, i) => {
                      const isFirst = i === 0 || products[i - 1].category !== p.category;
                      const key = `${company.id}_${p.id}`;
                      const isDirty = key in dirty;
                      const hasCustom = hasCustomPrice(company.id, p.id);
                      const displayVal = getDisplayPrice(company.id, p.id);

                      return (
                        <td
                          key={p.id}
                          className={`px-0.5 py-0.5 text-center ${
                            isFirst ? "border-l border-border" : ""
                          }`}
                        >
                          <input
                            type="number"
                            min={0}
                            value={displayVal}
                            placeholder={String(p.selling_price)}
                            onChange={(e) => handlePriceChange(company.id, p.id, e.target.value)}
                            aria-label={`${company.name} - ${p.name} 단가`}
                            className={`w-full px-1.5 py-1.5 text-center text-xs rounded border focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors ${
                              isDirty
                                ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300 font-bold"
                                : hasCustom
                                ? "border-primary/20 bg-primary/5 text-primary font-medium"
                                : "border-transparent bg-transparent text-text-muted hover:border-border hover:bg-bg-dark"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
