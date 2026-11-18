"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    login_id: "",
    password: "",
    passwordConfirm: "",
    name: "",
    company_name: "",
    biz_number: "",
    phone: "",
    email: "",
  });
  const [cert, setCert] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (form.password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (!cert) {
      setError("사업자등록증 파일을 올려주세요.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("login_id", form.login_id);
      fd.append("password", form.password);
      fd.append("name", form.name);
      fd.append("company_name", form.company_name);
      fd.append("biz_number", form.biz_number);
      fd.append("phone", form.phone);
      fd.append("email", form.email);
      fd.append("cert", cert);
      const res = await fetch("/api/auth/register", { method: "POST", body: fd });
      const data = await res.json();

      if (data.ok) {
        alert(
          (data.warning ? `가입은 되었지만 사업자등록증 업로드에 실패했습니다: ${data.warning}\n로그인 후 '내 정보'에서 다시 올려주세요.\n\n` : "") +
            "가입 신청이 접수되었습니다.\n관리자 승인이 완료되면 상품마다 귀사 단가가 표시됩니다.",
        );
        router.push("/login");
      } else {
        setError(data.error || "회원가입에 실패했습니다.");
      }
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const fields: {
    name: keyof typeof form;
    label: string;
    type?: string;
    required?: boolean;
    placeholder?: string;
    autoComplete?: string;
  }[] = [
    { name: "login_id", label: "아이디", required: true, placeholder: "4자 이상 영문·숫자", autoComplete: "username" },
    { name: "password", label: "비밀번호", type: "password", required: true, placeholder: "8자 이상", autoComplete: "new-password" },
    { name: "passwordConfirm", label: "비밀번호 확인", type: "password", required: true, placeholder: "비밀번호를 다시 입력", autoComplete: "new-password" },
    { name: "company_name", label: "업체명", required: true, placeholder: "사업자등록증상의 상호" },
    { name: "biz_number", label: "사업자등록번호", placeholder: "123-45-67890" },
    { name: "name", label: "담당자 이름", required: true, placeholder: "홍길동" },
    { name: "phone", label: "연락처", placeholder: "010-0000-0000", autoComplete: "tel" },
    { name: "email", label: "이메일", placeholder: "선택사항", autoComplete: "email" },
  ];

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-text-primary">
            밀포인트
          </Link>
          <p className="text-text-secondary mt-2">업체 회원가입</p>
          <p className="text-xs text-text-muted mt-2 leading-relaxed">
            가입 후 관리자가 사업자등록증을 확인해 승인하면<br />상품마다 귀사에 적용되는 단가가 표시됩니다.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-bg-card p-8 space-y-4"
        >
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm text-text-secondary mb-1">
                {f.label}
                {f.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              <input
                type={f.type || "text"}
                name={f.name}
                value={form[f.name]}
                onChange={handleChange}
                required={f.required}
                placeholder={f.placeholder}
                autoComplete={f.autoComplete}
                className="w-full px-4 py-3 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              사업자등록증 <span className="text-red-400 ml-1">*</span>
            </label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border bg-bg-dark cursor-pointer hover:border-primary transition-colors">
              {cert ? <FileText size={18} className="text-primary shrink-0" /> : <Upload size={18} className="text-text-muted shrink-0" />}
              <span className={`text-sm truncate ${cert ? "text-text-primary" : "text-text-muted"}`}>
                {cert ? `${cert.name} (${(cert.size / 1024 / 1024).toFixed(1)}MB)` : "이미지(JPG/PNG) 또는 PDF, 10MB 이하"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => setCert(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-[11px] text-text-muted mt-1">관리자만 열람하며 승인 심사 외 용도로 쓰지 않습니다.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? "신청 중..." : "가입 및 승인 요청"}
          </button>

          <p className="text-center text-sm text-text-muted">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-primary hover:underline">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
