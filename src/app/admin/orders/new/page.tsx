"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Company, Product } from "@/lib/supabase/types";
import { generateOrderNumber, formatNumber } from "@/lib/utils";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface OrderItemDraft {
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyPrices, setCompanyPrices] = useState<Record<string, number>>({});
  const [companyId, setCompanyId] = useState("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [c, p] = await Promise.all([
        (supabase.from("companies") as any)
          .select("*")
          .eq("is_active", true)
          .order("name"),
        (supabase.from("products") as any)
          .select("*")
          .eq("is_active", true)
          .order("name"),
      ]);
      setCompanies(c.data || []);
      setProducts(p.data || []);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 거래처 선택 시 해당 거래처의 단가 로드
  useEffect(() => {
    if (!companyId) { setCompanyPrices({}); return; }
    async function loadPrices() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("company_prices")
        .select("product_id, custom_price")
        .eq("company_id", companyId);
      const map: Record<string, number> = {};
      for (const row of data || []) {
        map[row.product_id] = Number(row.custom_price);
      }
      setCompanyPrices(map);
      // 기존 항목들의 단가도 업데이트
      setItems((prev) =>
        prev.map((item) => {
          const price = map[item.product_id] ?? products.find((p) => p.id === item.product_id)?.selling_price ?? item.unit_price;
          return { ...item, unit_price: price, amount: item.quantity * price };
        })
      );
    }
    loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function getProductPrice(productId: string): number {
    if (companyPrices[productId] !== undefined) return companyPrices[productId];
    const p = products.find((pr) => pr.id === productId);
    return p?.selling_price ?? 0;
  }

  function addItem() {
    if (products.length === 0) return;
    const p = products[0];
    const price = getProductPrice(p.id);
    setItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        unit: p.unit,
        quantity: 1,
        unit_price: price,
        amount: price,
      },
    ]);
  }

  function updateItem(index: number, field: string, value: string | number) {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };

      // 상품 변경 시 이름/단위/단가 동기화 (거래처 단가 우선, box_quantity 반영)
      if (field === "product_id") {
        const p = products.find((pr) => pr.id === value);
        if (p) {
          item.product_name = p.name;
          const eaPrice = getProductPrice(String(value));
          const boxQty = p.box_quantity || 1;
          if (boxQty > 1) {
            item.unit = "박스";
            item.unit_price = eaPrice * boxQty;
          } else {
            item.unit = p.unit || "EA";
            item.unit_price = eaPrice;
          }
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

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || items.length === 0) return;
    setSaving(true);

    const orderNumber = generateOrderNumber();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: order, error } = await db.from("orders").insert({
      order_number: orderNumber,
      company_id: companyId,
      order_date: orderDate,
      total_amount: totalAmount,
      notes: notes || null,
    }).select().single();

    if (error || !order) {
      alert("주문 생성 실패: " + (error?.message || "알 수 없는 오류"));
      setSaving(false);
      return;
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }));

    await db.from("order_items").insert(orderItems);

    router.push(`/admin/orders/${order.id}`);
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/orders"
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">새 주문 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* 기본 정보 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">기본 정보</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                거래처 <span className="text-red-400">*</span>
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">거래처 선택</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                주문일
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              메모
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
        </div>

        {/* 주문 항목 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              주문 항목
            </h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus size={16} /> 항목 추가
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-center py-8 text-text-muted">
              항목을 추가해주세요.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Header (desktop) */}
              <div className="hidden md:grid grid-cols-12 gap-3 text-xs text-text-muted px-1">
                <div className="col-span-4">상품</div>
                <div className="col-span-2">수량</div>
                <div className="col-span-2">단가</div>
                <div className="col-span-3 text-right">소계</div>
                <div className="col-span-1" />
              </div>

              {items.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-xl border border-border p-3"
                >
                  <div className="md:col-span-4">
                    <select
                      value={item.product_id}
                      onChange={(e) =>
                        updateItem(i, "product_id", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(i, "quantity", Number(e.target.value))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number"
                      min={0}
                      value={item.unit_price}
                      onChange={(e) =>
                        updateItem(i, "unit_price", Number(e.target.value))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="md:col-span-3 text-right text-text-primary font-medium">
                    {formatNumber(item.amount)}원
                  </div>
                  <div className="md:col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-text-secondary font-medium">총 합계</span>
            <span className="text-2xl font-bold text-text-primary">
              {formatNumber(totalAmount)}원
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/admin/orders"
            className="flex-1 py-3 text-center rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={saving || !companyId || items.length === 0}
            className="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : "주문 등록"}
          </button>
        </div>
      </form>
    </div>
  );
}
