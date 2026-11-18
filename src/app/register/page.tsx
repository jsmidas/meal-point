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
  // 아이디 가입 입력란은 선택했을 때만 펼친다 — 네이버 가입과 섞여 보이지 않게
  const [showIdForm, setShowIdForm] = useState(false);

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
      if (cert) fd.append("cert", cert);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (data.ok) {
        alert(
          data.warning
            ? `가입은 되었지만 사업자등록증 업로드에 실패했습니다: ${data.warning}\n로그인 후 '내 정보'에서 다시 올려주세요.`
            : data.cert_uploaded
              ? "가입이 완료되었습니다.\n사업자등록증 확인 후 승인되면 상품마다 귀사 단가가 표시됩니다."
              : "가입이 완료되었습니다.\n로그인 후 '내 정보'에서 사업자등록증을 올리면 업체 단가 승인을 요청할 수 있습니다.",
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
    {
      name: "login_id",
      label: "아이디",
      required: true,
      placeholder: "4자 이상 영문·숫자",
      autoComplete: "username",
    },
    {
      name: "password",
      label: "비밀번호",
      type: "password",
      required: true,
      placeholder: "8자 이상",
      autoComplete: "new-password",
    },
    {
      name: "passwordConfirm",
      label: "비밀번호 확인",
      type: "password",
      required: true,
      placeholder: "비밀번호를 다시 입력",
      autoComplete: "new-password",
    },
    {
      name: "company_name",
      label: "업체명",
      required: true,
      placeholder: "사업자등록증상의 상호",
    },
    {
      name: "biz_number",
      label: "사업자등록번호",
      placeholder: "123-45-67890",
    },
    {
      name: "name",
      label: "담당자 이름",
      required: true,
      placeholder: "홍길동",
    },
    {
      name: "phone",
      label: "연락처",
      placeholder: "010-0000-0000",
      autoComplete: "tel",
    },
    {
      name: "email",
      label: "이메일",
      placeholder: "선택사항",
      autoComplete: "email",
    },
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
            가입 후 바로 로그인할 수 있습니다. 사업자등록증을 올려
            <br />
            승인받으면 상품마다 귀사에 적용되는 단가가 표시됩니다.
          </p>
        </div>

        {/* 방법 1 — 간편 가입(네이버·카카오·구글): 아이디·비밀번호를 받지 않는다 */}
        <section className="rounded-2xl border border-border bg-bg-card p-8">
          <p className="text-xs font-semibold text-primary mb-1">방법 1</p>
          <h2 className="text-base font-semibold text-text-primary mb-1">
            간편 가입
          </h2>
          <p className="text-xs text-text-muted mb-4 leading-relaxed">
            아이디·비밀번호 입력 없이 네이버·카카오·구글 계정으로 바로
            가입됩니다.
          </p>
          <a
            href="/api/auth/naver?next=/account"
            className="w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 text-white"
            style={{ backgroundColor: "#03C75A" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M13.5 10.56L6.26 0H0v20h6.5V9.44L13.74 20H20V0h-6.5v10.56z"
                fill="white"
              />
            </svg>
            네이버로 간편 가입
          </a>
          <a
            href="/api/auth/kakao?next=/account"
            className="mt-2 w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 text-[#191919]"
            style={{ backgroundColor: "#FEE500" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 1C4.477 1 0 4.477 0 8.667c0 2.7 1.752 5.076 4.396 6.443l-1.12 4.11a.3.3 0 00.456.326l4.764-3.16c.487.05.983.076 1.504.076 5.523 0 10-3.477 10-7.795C20 4.477 15.523 1 10 1z"
                fill="#191919"
              />
            </svg>
            카카오로 간편 가입
          </a>
          <a
            href="/api/auth/google?next=/account"
            className="mt-2 w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 border border-border text-[#222] bg-white hover:bg-gray-100"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            Google로 간편 가입
          </a>
          <p className="text-[11px] text-text-muted mt-3 text-center leading-relaxed">
            가입 후 &apos;내 정보&apos;에서 사업자등록증을 올리면 단가 승인을
            요청할 수 있습니다.
            <br />
            가입 시{" "}
            <Link href="/privacy" className="underline hover:text-text-primary">
              개인정보처리방침
            </Link>
            에 동의한 것으로 봅니다.
          </p>
        </section>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-text-muted">또는</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* 방법 2 — 아이디 가입: 간편 가입과 무관한 별도 절차. 선택했을 때만 입력란을 펼친다 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-bg-card p-8 space-y-4"
        >
          <div>
            <p className="text-xs font-semibold text-primary mb-1">방법 2</p>
            <h2 className="text-base font-semibold text-text-primary mb-1">
              아이디로 가입
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              간편 가입을 쓰지 않고, 밀포인트 전용 아이디와 비밀번호를 만들어
              가입합니다.
            </p>
          </div>

          {!showIdForm ? (
            <button
              type="button"
              onClick={() => setShowIdForm(true)}
              className="w-full py-3 rounded-xl border border-border text-text-primary font-semibold text-sm hover:bg-white/5 transition-colors"
            >
              아이디·비밀번호로 가입하기
            </button>
          ) : (
            <>
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
                  사업자등록증{" "}
                  <span className="text-text-muted ml-1">(선택)</span>
                </label>
                <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border bg-bg-dark cursor-pointer hover:border-primary transition-colors">
                  {cert ? (
                    <FileText size={18} className="text-primary shrink-0" />
                  ) : (
                    <Upload size={18} className="text-text-muted shrink-0" />
                  )}
                  <span
                    className={`text-sm truncate ${cert ? "text-text-primary" : "text-text-muted"}`}
                  >
                    {cert
                      ? `${cert.name} (${(cert.size / 1024 / 1024).toFixed(1)}MB)`
                      : "이미지(JPG/PNG) 또는 PDF, 10MB 이하"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => setCert(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                  지금 올리지 않아도 됩니다. 가입 후 &apos;내 정보&apos;에서
                  올리면 승인 요청이 접수됩니다.
                  <br />
                  관리자만 열람하며 승인 심사 외 용도로 쓰지 않습니다.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {loading ? "가입 중..." : "가입하기"}
              </button>
            </>
          )}
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
