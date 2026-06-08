"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface PortalProduct {
  id: string;
  name: string;
  unit: string;
  price: number;
}
interface Line {
  product_id: string;
  quantity: number;
}

export default function PortalNewOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/portal/products");
      const data = await res.json();
      if (data.ok) setProducts(data.products);
      else setError(data.error || "상품을 불러오지 못했습니다.");
      setLoading(false);
    })();
  }, []);

  const priceOf = (id: string) => products.find((p) => p.id === id)?.price ?? 0;
  const unitOf = (id: string) => products.find((p) => p.id === id)?.unit ?? "";

  function addLine() {
    if (products.length === 0) return;
    setLines((prev) => [...prev, { product_id: products[0].id, quantity: 1 }]);
  }
  function updateLine(i: number, field: keyof Line, value: string | number) {
    setLines((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = lines.reduce((s, l) => s + priceOf(l.product_id) * (l.quantity || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = lines.filter((l) => l.product_id && l.quantity > 0);
    if (valid.length === 0) {
      setError("발주할 상품과 수량을 입력하세요.");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch("/api/portal/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: valid.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        notes,
        order_date: orderDate,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!data.ok) {
      setError(data.error || "발주에 실패했습니다.");
      return;
    }
    router.push("/portal");
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/portal"
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-text-primary">새 발주</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-text-muted">불러오는 중...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">희망 발주일</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-card text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text-primary">발주 품목</h2>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                <Plus size={16} /> 품목 추가
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="text-center py-8 text-text-muted text-sm">
                품목을 추가해주세요.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="hidden sm:grid grid-cols-12 gap-3 text-xs text-text-muted px-1">
                  <div className="col-span-5">상품</div>
                  <div className="col-span-2">수량</div>
                  <div className="col-span-2 text-right">단가</div>
                  <div className="col-span-2 text-right">금액</div>
                  <div className="col-span-1" />
                </div>
                {lines.map((l, i) => {
                  const price = priceOf(l.product_id);
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center rounded-xl border border-border p-3"
                    >
                      <div className="sm:col-span-5">
                        <select
                          value={l.product_id}
                          onChange={(e) => updateLine(i, "product_id", e.target.value)}
                          aria-label="상품 선택"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                          aria-label="수량"
                          className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="sm:col-span-2 text-right text-sm text-text-secondary">
                        {formatNumber(price)}
                        <span className="text-text-muted">/{unitOf(l.product_id)}</span>
                      </div>
                      <div className="sm:col-span-2 text-right text-sm font-medium text-text-primary">
                        {formatNumber(price * (l.quantity || 0))}원
                      </div>
                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          aria-label="삭제"
                          className="p-1.5 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-text-secondary font-medium">합계 (예상)</span>
              <span className="text-2xl font-bold text-text-primary">
                {formatNumber(total)}원
              </span>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              단가는 거래처에 등록된 가격으로 자동 적용되며, 최종 금액은 관리자 확인 후 확정됩니다.
            </p>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">요청사항 (선택)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="배송 희망일, 특이사항 등"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3">
            <Link
              href="/portal"
              className="flex-1 py-3 text-center rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={saving || lines.length === 0}
              className="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? "발주 중..." : "발주 넣기"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
