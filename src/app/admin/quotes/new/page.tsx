"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Company, Product } from "@/lib/supabase/types";
import { generateQuoteNumber, formatNumber } from "@/lib/utils";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface QuoteItemDraft {
  product_id: string | null;
  product_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export default function NewQuotePage() {
  const router = useRouter();
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuoteItemDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [c, p] = await Promise.all([
        db.from("companies").select("*").eq("is_active", true).order("name"),
        db.from("products").select("*").eq("is_active", true).order("name"),
      ]);
      setCompanies(c.data || []);
      setProducts(p.data || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addItem() {
    if (products.length > 0) {
      const p = products[0];
      setItems((prev) => [...prev, {
        product_id: p.id,
        product_name: p.name,
        specification: "",
        unit: p.unit,
        quantity: 1,
        unit_price: p.selling_price,
        amount: p.selling_price,
      }]);
    } else {
      setItems((prev) => [...prev, {
        product_id: null,
        product_name: "",
        specification: "",
        unit: "EA",
        quantity: 1,
        unit_price: 0,
        amount: 0,
      }]);
    }
  }

  function updateItem(index: number, field: string, value: string | number | null) {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      if (field === "product_id" && value) {
        const p = products.find((pr) => pr.id === value);
        if (p) {
          item.product_name = p.name;
          item.unit = p.unit;
          item.unit_price = p.selling_price;
        }
      }
      item.amount = item.quantity * item.unit_price;
      copy[index] = item;
      return copy;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const supplyAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const taxAmount = Math.round(supplyAmount * 0.1);
  const totalAmount = supplyAmount + taxAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || items.length === 0) return;
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: quote, error } = await db.from("quotes").insert({
      quote_number: generateQuoteNumber(),
      company_id: companyId,
      quote_date: quoteDate,
      valid_until: validUntil || null,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: notes || null,
    }).select().single();

    if (error || !quote) {
      alert("생성 실패: " + (error?.message || "알 수 없는 오류"));
      setSaving(false);
      return;
    }

    await db.from("quote_items").insert(
      items.map((item) => ({
        quote_id: quote.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        specification: item.specification || null,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      })),
    );

    router.push(`/admin/quotes/${quote.id}`);
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/quotes" className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">견적서 작성</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">기본 정보</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                거래처 <span className="text-red-400">*</span>
              </label>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors">
                <option value="">거래처 선택</option>
                {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">견적일</label>
              <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">유효기간</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">비고</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors resize-none" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">견적 항목</h2>
            <button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
              <Plus size={16} /> 항목 추가
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-center py-8 text-text-muted">항목을 추가해주세요.</p>
          ) : (
            <div className="space-y-3">
              <div className="hidden lg:grid grid-cols-12 gap-3 text-xs text-text-muted px-1">
                <div className="col-span-3">상품</div>
                <div className="col-span-2">규격</div>
                <div className="col-span-1">단위</div>
                <div className="col-span-1">수량</div>
                <div className="col-span-2">단가</div>
                <div className="col-span-2 text-right">금액</div>
                <div className="col-span-1" />
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center rounded-xl border border-border p-3">
                  <div className="lg:col-span-3">
                    <select value={item.product_id || ""} onChange={(e) => updateItem(i, "product_id", e.target.value || null)} className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary">
                      <option value="">직접 입력</option>
                      {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </select>
                    {!item.product_id && (
                      <input type="text" placeholder="품목명" value={item.product_name} onChange={(e) => updateItem(i, "product_name", e.target.value)} className="w-full mt-2 px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" required />
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <input type="text" placeholder="규격" value={item.specification} onChange={(e) => updateItem(i, "specification", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="lg:col-span-1">
                    <input type="text" value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="lg:col-span-1">
                    <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="lg:col-span-2">
                    <input type="number" min={0} value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="lg:col-span-2 text-right text-text-primary font-medium">{formatNumber(item.amount)}원</div>
                  <div className="lg:col-span-1 text-right">
                    <button type="button" onClick={() => removeItem(i)} className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">공급가액</span>
              <span className="text-text-primary">{formatNumber(supplyAmount)}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">세액 (10%)</span>
              <span className="text-text-primary">{formatNumber(taxAmount)}원</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-text-secondary font-medium">합계</span>
              <span className="text-2xl font-bold text-text-primary">{formatNumber(totalAmount)}원</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/admin/quotes" className="flex-1 py-3 text-center rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors">취소</Link>
          <button type="submit" disabled={saving || !companyId || items.length === 0} className="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50">
            {saving ? "저장 중..." : "견적서 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
