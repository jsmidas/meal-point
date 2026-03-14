"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    login_id: "",
    password: "",
    passwordConfirm: "",
    name: "",
    company_name: "",
    phone: "",
    email: "",
  });
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

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: form.login_id,
          password: form.password,
          name: form.name,
          company_name: form.company_name,
          phone: form.phone,
          email: form.email,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        alert("회원가입이 완료되었습니다. 로그인해주세요.");
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
  }[] = [
    { name: "login_id", label: "아이디", required: true, placeholder: "4자 이상" },
    { name: "password", label: "비밀번호", type: "password", required: true, placeholder: "4자 이상" },
    { name: "passwordConfirm", label: "비밀번호 확인", type: "password", required: true, placeholder: "비밀번호를 다시 입력" },
    { name: "name", label: "이름", required: true, placeholder: "홍길동" },
    { name: "company_name", label: "업체명", placeholder: "선택사항" },
    { name: "phone", label: "연락처", placeholder: "010-0000-0000" },
    { name: "email", label: "이메일", placeholder: "선택사항" },
  ];

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-text-primary">
            밀포인트
          </Link>
          <p className="text-text-secondary mt-2">회원가입</p>
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
                className="w-full px-4 py-3 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? "가입 중..." : "회원가입"}
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
