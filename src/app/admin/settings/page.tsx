"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CompanyInfo } from "@/lib/supabase/types";
import { Upload, Trash2, Save, Image as ImageIcon } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    ceo_name: "",
    biz_number: "",
    biz_type: "",
    biz_category: "",
    address: "",
    phone: "",
    email: "",
    bank_name: "",
    bank_account: "",
    bank_holder: "",
    logo_image_url: "",
    stamp_image_url: "",
  });

  useEffect(() => {
    fetchCompanyInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchCompanyInfo() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("company_info").select("*").limit(1).maybeSingle();
    if (data) {
      setCompanyInfo(data);
      setForm({
        name: data.name || "",
        ceo_name: data.ceo_name || "",
        biz_number: data.biz_number || "",
        biz_type: data.biz_type || "",
        biz_category: data.biz_category || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        bank_name: data.bank_name || "",
        bank_account: data.bank_account || "",
        bank_holder: data.bank_holder || "",
        logo_image_url: data.logo_image_url || "",
        stamp_image_url: data.stamp_image_url || "",
      });
    }
    setLoading(false);
  }

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const ext = file.name.split(".").pop();
    const fileName = `logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      setMessage({ type: "error", text: `업로드 실패: ${uploadError.message}` });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    setForm((prev) => ({ ...prev, logo_image_url: publicUrl }));
    setMessage({ type: "success", text: "로고가 업로드되었습니다. 저장 버튼을 눌러주세요." });
    setUploading(false);
  }

  function handleRemoveLogo() {
    setForm((prev) => ({ ...prev, logo_image_url: "" }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    if (companyInfo) {
      const { error } = await db.from("company_info").update(form).eq("id", companyInfo.id);
      if (error) {
        setMessage({ type: "error", text: `저장 실패: ${error.message}` });
      } else {
        setMessage({ type: "success", text: "회사 정보가 저장되었습니다." });
      }
    } else {
      const { error } = await db.from("company_info").insert(form);
      if (error) {
        setMessage({ type: "error", text: `등록 실패: ${error.message}` });
      } else {
        setMessage({ type: "success", text: "회사 정보가 등록되었습니다." });
      }
    }

    setSaving(false);
    fetchCompanyInfo();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  if (loading) {
    return <div className="text-center py-20 text-text-muted">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-8">회사 정보 설정</h1>

      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-xl text-sm ${
            message.type === "success"
              ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
              : "bg-red-400/10 text-red-400 border border-red-400/30"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* 로고 섹션 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">회사 로고</h2>
          <p className="text-sm text-text-muted mb-4">
            견적서, 거래명세서, 홈페이지에 표시되는 로고입니다.
          </p>

          <div className="flex items-start gap-6">
            {/* 로고 미리보기 */}
            <div className="w-48 h-48 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-bg-dark overflow-hidden">
              {form.logo_image_url ? (
                <img
                  src={form.logo_image_url}
                  alt="회사 로고"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center">
                  <ImageIcon size={32} className="mx-auto text-text-muted mb-2" />
                  <p className="text-xs text-text-muted">로고 없음</p>
                </div>
              )}
            </div>

            {/* 업로드 버튼 */}
            <div className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadLogo}
                className="hidden"
                aria-label="로고 업로드"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                <Upload size={16} />
                {uploading ? "업로드 중..." : "로고 업로드"}
              </button>
              {form.logo_image_url && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-400/30 text-red-400 text-sm hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 size={16} />
                  로고 삭제
                </button>
              )}
              <p className="text-xs text-text-muted">
                PNG, JPG, SVG 권장 / 투명 배경 PNG 추천
              </p>
            </div>
          </div>
        </div>

        {/* 기본 정보 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">기본 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">상호명</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">대표자명</label>
              <input type="text" name="ceo_name" value={form.ceo_name} onChange={handleChange} required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">사업자번호</label>
              <input type="text" name="biz_number" value={form.biz_number} onChange={handleChange} required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">업태</label>
              <input type="text" name="biz_type" value={form.biz_type} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">종목</label>
              <input type="text" name="biz_category" value={form.biz_category} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">주소</label>
              <input type="text" name="address" value={form.address} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">전화번호</label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">이메일</label>
              <input type="text" name="email" value={form.email} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* 계좌 정보 */}
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">계좌 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">은행명</label>
              <input type="text" name="bank_name" value={form.bank_name} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">계좌번호</label>
              <input type="text" name="bank_account" value={form.bank_account} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">예금주</label>
              <input type="text" name="bank_holder" value={form.bank_holder} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* 저장 */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
