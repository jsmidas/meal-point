"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STORAGE_KEY = "mp_saved_credentials";

export default function LoginPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { id: savedId, password: savedPw } = JSON.parse(saved);
        setId(savedId || "");
        setPassword(savedPw || "");
        setRemember(true);
      }
    } catch {
      // ignore
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", id, password }),
      });
      const data = await res.json();

      if (data.ok) {
        if (remember) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, password }));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
        router.push(data.role === "admin" ? "/admin" : "/");
      } else {
        setError(data.error || "로그인에 실패했습니다.");
      }
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-text-primary">
            밀포인트
          </Link>
          <p className="text-text-secondary mt-2">로그인</p>
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

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              아이디
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
              autoFocus
              placeholder="admin"
              className="w-full px-4 py-3 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••"
              className="w-full px-4 py-3 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-primary"
            />
            <label htmlFor="remember" className="text-sm text-text-secondary">
              아이디/비밀번호 저장
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-bg-card px-3 text-text-muted">또는</span>
            </div>
          </div>

          <div className="space-y-2">
            <a
              href="/api/auth/naver"
              className="w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 text-white"
              style={{ backgroundColor: "#03C75A" }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M13.5 10.56L6.26 0H0v20h6.5V9.44L13.74 20H20V0h-6.5v10.56z" fill="white"/>
              </svg>
              네이버로 로그인
            </a>

            <a
              href="/api/auth/kakao"
              className="w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 text-[#191919]"
              style={{ backgroundColor: "#FEE500" }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 1C4.477 1 0 4.477 0 8.667c0 2.7 1.752 5.076 4.396 6.443l-1.12 4.11a.3.3 0 00.456.326l4.764-3.16c.487.05.983.076 1.504.076 5.523 0 10-3.477 10-7.795C20 4.477 15.523 1 10 1z" fill="#191919"/>
              </svg>
              카카오로 로그인
            </a>

            <a
              href="/api/auth/google"
              className="w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 border border-border text-[#222] bg-white hover:bg-gray-100"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Google로 로그인
            </a>
          </div>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          계정이 없으신가요?{" "}
          <Link href="/register" className="text-primary hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
