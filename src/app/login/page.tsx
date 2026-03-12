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
        router.push("/admin");
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
          <p className="text-text-secondary mt-2">관리자 로그인</p>
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
        </form>

        <p className="text-center text-xs text-text-muted mt-6">
          밀포인트 관리자 전용 페이지입니다.
        </p>
      </div>
    </div>
  );
}
