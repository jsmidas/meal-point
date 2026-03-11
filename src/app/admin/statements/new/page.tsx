"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Company, OrderWithItems } from "@/lib/supabase/types";
import { generateStatementNumber, formatNumber } from "@/lib/utils";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface StatementItemDraft {
  product_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

function NewStatementForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [statementDate, setStatementDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<StatementItemDraft[]>([]);
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(
    orderId || null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const { data: companiesData } = await db
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");
      setCompanies(companiesData || []);

      // 주문에서 자동 채움
      if (orderId) {
        const { data: order } = await db
          .from("orders")
          .select("*, companies(*), order_items(*)")
          .eq("id", orderId)
          .single();

        if (order) {
          const o = order as OrderWithItems;
          setCompanyId(o.company_id);
          setItems(
            o.order_items.map((item) => ({
              product_name: item.product_name,
              specification: "",
              unit: item.unit,
              quantity: item.quantity,
              unit_price: item.unit_price,
              amount: item.amount,
            })),
          );
        }
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        product_name: "",
        specification: "",
        unit: "EA",
        quantity: 1,
        unit_price: 0,
        amount: 0,
      },
    ]);
  }

  function updateItem(index: number, field: string, value: string | number) {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        item.amount = item.quantity * item.unit_price;
      }
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

    const statementNumber = generateStatementNumber();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: statement, error } = await db.from("statements").insert({
      statement_number: statementNumber,
      order_id: linkedOrderId || null,
      company_id: companyId,
      statement_date: statementDate,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: notes || null,
    }).select().single();

    if (error || !statement) {
      alert("생성 실패: " + (error?.message || "알 수 없는 오류"));
      setSaving(false);
      return;
    }

    const stItems = items.map((item) => ({
      statement_id: statement.id,
      product_name: item.product_name,
      specification: item.specification || null,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }));

    await db.from("statement_items").insert(stItems);

    router.push(`/admin/statements/${statement.id}`);
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/statements"
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">
          거래명세서 작성
        </h1>
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
                작성일
              </label>
              <input
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              비고
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
        </div>

        {/* 항목 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">항목</h2>
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
              <div className="hidden lg:grid grid-cols-12 gap-3 text-xs text-text-muted px-1">
                <div className="col-span-3">품목</div>
                <div className="col-span-2">규격</div>
                <div className="col-span-1">단위</div>
                <div className="col-span-1">수량</div>
                <div className="col-span-2">단가</div>
                <div className="col-span-2 text-right">금액</div>
                <div className="col-span-1" />
              </div>

              {items.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center rounded-xl border border-border p-3"
                >
                  <div className="lg:col-span-3">
                    <input
                      type="text"
                      placeholder="품목명"
                      value={item.product_name}
                      onChange={(e) =>
                        updateItem(i, "product_name", e.target.value)
                      }
                      required
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <input
                      type="text"
                      placeholder="규격"
                      value={item.specification}
                      onChange={(e) =>
                        updateItem(i, "specification", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(i, "unit", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="lg:col-span-1">
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
                  <div className="lg:col-span-2">
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
                  <div className="lg:col-span-2 text-right text-text-primary font-medium">
                    {formatNumber(item.amount)}원
                  </div>
                  <div className="lg:col-span-1 text-right">
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

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">공급가액</span>
              <span className="text-text-primary">
                {formatNumber(supplyAmount)}원
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">세액 (10%)</span>
              <span className="text-text-primary">
                {formatNumber(taxAmount)}원
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-text-secondary font-medium">합계</span>
              <span className="text-2xl font-bold text-text-primary">
                {formatNumber(totalAmount)}원
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/admin/statements"
            className="flex-1 py-3 text-center rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={saving || !companyId || items.length === 0}
            className="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : "거래명세서 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewStatementPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-text-muted">로딩 중...</div>}>
      <NewStatementForm />
    </Suspense>
  );
}
