"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company, Product } from "@/lib/supabase/types";
import { formatNumber } from "@/lib/utils";
import { Save, Check, Building2, Package } from "lucide-react";

type PriceMap = Record<string, number>; // `${companyId}_${productId}` → price
type DirtySet = Set<string>;

export default function PricesPage() {
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [dirty, setDirty] = useState<DirtySet>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<"company" | "product">("company");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");

  const load = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [cRes, pRes, prRes] = await Promise.all([
      db.from("companies").select("*").eq("is_active", true).eq("company_type", "customer").order("name"),
      db.from("products").select("*").eq("is_active", true).order("name"),
      db.from("company_prices").select("*"),
    ]);

    const comps: Company[] = cRes.data || [];
    const prods: Product[] = pRes.data || [];
    setCompanies(comps);
    setProducts(prods);

    const map: PriceMap = {};
    for (const row of prRes.data || []) {
      map[`${row.company_id}_${row.product_id}`] = Number(row.custom_price);
    }
    setPrices(map);

    if (comps.length > 0 && !selectedCompany) setSelectedCompany(comps[0].id);
    if (prods.length > 0 && !selectedProduct) setSelectedProduct(prods[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  function getPrice(companyId: string, productId: string): number | undefined {
    return prices[`${companyId}_${productId}`];
  }

  function setPrice(companyId: string, productId: string, value: number) {
    const key = `${companyId}_${productId}`;
    setPrices((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => new Set(prev).add(key));
    setSaved(false);
  }

  async function handleSave() {
    if (dirty.size === 0) return;
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const upserts = Array.from(dirty).map((key) => {
      const [companyId, productId] = key.split("_");
      return {
        company_id: companyId,
        product_id: productId,
        custom_price: prices[key],
      };
    });

    const { error } = await db
      .from("company_prices")
      .upsert(upserts, { onConflict: "company_id,product_id" });

    if (error) {
      alert("저장 실패: " + error.message);
    } else {
      setDirty(new Set());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  const filteredCompanies = viewMode === "company" && selectedCompany
    ? companies.filter((c) => c.id === selectedCompany)
    : companies;

  const filteredProducts = viewMode === "product" && selectedProduct
    ? products.filter((p) => p.id === selectedProduct)
    : products;

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-text-primary">거래처별 단가 관리</h1>
        <button
          onClick={handleSave}
          disabled={saving || dirty.size === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {saved ? <Check size={18} /> : <Save size={18} />}
          {saving ? "저장 중..." : saved ? "저장됨" : `저장 (${dirty.size})`}
        </button>
      </div>

      {/* 뷰 모드 토글 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode("company")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            viewMode === "company"
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-bg-card text-text-secondary border border-border hover:bg-bg-card-hover"
          }`}
        >
          <Building2 size={16} /> 거래처별 보기
        </button>
        <button
          onClick={() => setViewMode("product")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            viewMode === "product"
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-bg-card text-text-secondary border border-border hover:bg-bg-card-hover"
          }`}
        >
          <Package size={16} /> 상품별 보기
        </button>
      </div>

      {/* 거래처별 보기 */}
      {viewMode === "company" && (
        <div className="space-y-6">
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">전체 거래처</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {filteredCompanies.map((company) => (
            <div key={company.id} className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-bg-card-hover">
                <h3 className="font-semibold text-text-primary">{company.name}</h3>
                <p className="text-xs text-text-muted">{company.biz_number}</p>
              </div>
              <div className="divide-y divide-border">
                {products.map((product) => {
                  const key = `${company.id}_${product.id}`;
                  const customPrice = getPrice(company.id, product.id);
                  const isDirty = dirty.has(key);
                  return (
                    <div key={product.id} className="flex items-center gap-4 px-6 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium truncate">{product.name}</p>
                        <p className="text-xs text-text-muted">
                          기본가: {formatNumber(product.selling_price)}원 / {product.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={customPrice ?? ""}
                          placeholder={String(product.selling_price)}
                          onChange={(e) => setPrice(company.id, product.id, Number(e.target.value))}
                          className={`w-28 px-3 py-2 rounded-lg border text-sm text-right focus:outline-none focus:border-primary transition-colors ${
                            isDirty
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border bg-bg-dark text-text-primary"
                          }`}
                        />
                        <span className="text-xs text-text-muted">원</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상품별 보기 */}
      {viewMode === "product" && (
        <div className="space-y-6">
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">전체 상품</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {filteredProducts.map((product) => (
            <div key={product.id} className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-bg-card-hover">
                <h3 className="font-semibold text-text-primary">{product.name}</h3>
                <p className="text-xs text-text-muted">
                  기본 판매가: {formatNumber(product.selling_price)}원 / {product.unit}
                </p>
              </div>
              <div className="divide-y divide-border">
                {companies.map((company) => {
                  const key = `${company.id}_${product.id}`;
                  const customPrice = getPrice(company.id, product.id);
                  const isDirty = dirty.has(key);
                  const diff = customPrice !== undefined ? customPrice - product.selling_price : 0;
                  return (
                    <div key={company.id} className="flex items-center gap-4 px-6 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium truncate">{company.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={customPrice ?? ""}
                          placeholder={String(product.selling_price)}
                          onChange={(e) => setPrice(company.id, product.id, Number(e.target.value))}
                          className={`w-28 px-3 py-2 rounded-lg border text-sm text-right focus:outline-none focus:border-primary transition-colors ${
                            isDirty
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border bg-bg-dark text-text-primary"
                          }`}
                        />
                        <span className="text-xs text-text-muted">원</span>
                        {customPrice !== undefined && diff !== 0 && (
                          <span className={`text-xs ${diff > 0 ? "text-green-400" : "text-red-400"}`}>
                            ({diff > 0 ? "+" : ""}{formatNumber(diff)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {companies.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          <Building2 size={48} className="mx-auto mb-4 opacity-50" />
          <p>등록된 판매처가 없습니다.</p>
          <p className="text-sm mt-1">거래처 관리에서 판매처를 먼저 등록해주세요.</p>
        </div>
      )}
    </div>
  );
}
