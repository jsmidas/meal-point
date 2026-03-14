"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company, Database } from "@/lib/supabase/types";
import { X } from "lucide-react";

interface Props {
  company: Company | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = {
  name: "",
  ceo_name: "",
  biz_number: "",
  biz_type: "",
  biz_category: "",
  address: "",
  phone: "",
  email: "",
  contact_person: "",
  contact_phone: "",
  notes: "",
  company_type: "customer" as string,
  is_active: true,
};

export default function CompanyModal({ company, onClose, onSaved }: Props) {
  const isEdit = !!company;
  const [form, setForm] = useState(
    company
      ? {
          name: company.name,
          ceo_name: company.ceo_name,
          biz_number: company.biz_number,
          biz_type: company.biz_type || "",
          biz_category: company.biz_category || "",
          address: company.address || "",
          phone: company.phone || "",
          email: company.email || "",
          contact_person: company.contact_person || "",
          contact_phone: company.contact_phone || "",
          notes: company.notes || "",
          company_type: (company as any).company_type || "customer",
          is_active: company.is_active,
        }
      : emptyForm,
  );
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase.from("companies") as any;
    if (isEdit) {
      await db.update(form).eq("id", company!.id);
    } else {
      await db.insert(form);
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  const fields: {
    name: keyof typeof form;
    label: string;
    required?: boolean;
    placeholder?: string;
  }[] = [
    { name: "name", label: "상호명", required: true, placeholder: "예: (주)밀포인트" },
    { name: "ceo_name", label: "대표자", required: true, placeholder: "홍길동" },
    {
      name: "biz_number",
      label: "사업자등록번호",
      required: true,
      placeholder: "000-00-00000",
    },
    { name: "biz_type", label: "업태", placeholder: "예: 제조업" },
    { name: "biz_category", label: "종목", placeholder: "예: 플라스틱용기" },
    { name: "address", label: "주소" },
    { name: "phone", label: "대표 연락처", placeholder: "02-0000-0000" },
    { name: "email", label: "이메일" },
    { name: "contact_person", label: "담당자명" },
    { name: "contact_phone", label: "담당자 연락처" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">
            {isEdit ? "거래처 수정" : "거래처 추가"}
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
            {fields.map((f) => (
              <div key={f.name}>
                <label className="block text-sm text-text-secondary mb-1">
                  {f.label}
                  {f.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <input
                  type="text"
                  name={f.name}
                  value={form[f.name] as string}
                  onChange={handleChange}
                  required={f.required}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              거래처 유형 <span className="text-red-400 ml-1">*</span>
            </label>
            <select
              name="company_type"
              value={form.company_type}
              onChange={handleChange}
              aria-label="거래처 유형 선택"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary transition-colors"
            >
              <option value="customer">판매처 (거래처)</option>
              <option value="supplier">매입처 (공급업체)</option>
              <option value="both">양쪽 (매입 + 판매)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              메모
            </label>
            <textarea
              name="notes"
              value={form.notes}
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
                활성 거래처
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
