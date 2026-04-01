"use client";

import { useState } from "react";
import { dbInsert, dbUpdate } from "@/lib/db";
import type { Product, Database } from "@/lib/supabase/types";
import { X } from "lucide-react";

interface Props {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

const categories = [
  { value: "inner", label: "내피" },
  { value: "outer", label: "외피" },
  { value: "heater", label: "발열제" },
  { value: "film", label: "필름" },
  { value: "set", label: "세트" },
];

const units = ["EA", "BOX", "SET", "PACK", "ROLL"];

const emptyForm = {
  name: "",
  category: "inner",
  unit: "EA",
  box_quantity: 1,
  cost_price: 0,
  selling_price: 0,
  description: "",
  is_active: true,
};

export default function ProductModal({ product, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const [form, setForm] = useState(
    product
      ? {
          name: product.name,
          category: product.category,
          unit: product.unit,
          box_quantity: product.box_quantity ?? 1,
          cost_price: product.cost_price,
          selling_price: product.selling_price,
          description: product.description || "",
          is_active: product.is_active,
        }
      : emptyForm,
  );
  const [saving, setSaving] = useState(false);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : type === "number"
            ? Number(value)
            : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (isEdit) {
      await dbUpdate("products", form, { id: product!.id });
    } else {
      await dbInsert("products", form);
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  const margin =
    form.selling_price > 0
      ? (((form.selling_price - form.cost_price) / form.selling_price) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">
            {isEdit ? "상품 수정" : "상품 추가"}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                상품명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="예: 일품 6칸 내피"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                카테고리 <span className="text-red-400">*</span>
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                단위
              </label>
              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                박스당 수량
              </label>
              <input
                type="number"
                name="box_quantity"
                value={form.box_quantity}
                onChange={handleChange}
                min={1}
                placeholder="예: 300"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                개당 원가 (원)
              </label>
              <input
                type="number"
                name="cost_price"
                value={form.cost_price}
                onChange={handleChange}
                min={0}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                개당 판매가 (원)
              </label>
              <input
                type="number"
                name="selling_price"
                value={form.selling_price}
                onChange={handleChange}
                min={0}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Box price & Margin indicator */}
          <div className="px-4 py-3 rounded-xl bg-bg-dark border border-border text-sm space-y-1">
            {form.box_quantity > 1 && (
              <div>
                <span className="text-text-secondary">박스 단가: </span>
                <span className="text-text-primary font-semibold">
                  원가 {(form.cost_price * form.box_quantity).toLocaleString()}원
                </span>
                <span className="text-text-muted mx-1">/</span>
                <span className="text-primary font-semibold">
                  판매가 {(form.selling_price * form.box_quantity).toLocaleString()}원
                </span>
                <span className="text-text-muted ml-1">
                  ({form.box_quantity}개/박스)
                </span>
              </div>
            )}
            <div>
              <span className="text-text-secondary">마진율: </span>
              <span
                className={`font-semibold ${
                  Number(margin) > 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {margin}%
              </span>
              <span className="text-text-muted ml-2">
                (개당 이익: {(form.selling_price - form.cost_price).toLocaleString()}원
                {form.box_quantity > 1 && ` / 박스 이익: ${((form.selling_price - form.cost_price) * form.box_quantity).toLocaleString()}원`})
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              설명
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
                className="accent-primary"
              />
              <label htmlFor="is_active" className="text-sm text-text-secondary">
                판매중
              </label>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {saving ? "저장 중..." : isEdit ? "수정" : "등록"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
