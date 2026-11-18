"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { homeForRole } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/auth/safe-next";

const STORAGE_KEY = "mp_saved_credentials";

// 소셜 로그인 콜백이 ?error= 로 돌려보낸 사유 안내
const SOCIAL_ERRORS: Record<string, string> = {
  cancelled: "로그인이 취소되었습니다.",
  invalid_state: "로그인 시간이 초과되었거나 잘못된 접근입니다. 다시 시도해 주세요.",
  inactive: "사용이 중지된 계정입니다. 관리자에게 문의해 주세요.",
  naver_not_configured: "네이버 로그인이 아직 설정되지 않았습니다.",
  not_configured: "이 로그인 방법은 아직 설정되지 않았습니다.",
};
const SOCIAL_ERROR_DEFAULT = "소셜 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";

interface SavedLogin {
  id: string;
  /** 비밀번호는 사용자가 "비밀번호도 저장"을 켠 경우에만 들어 있다 */
  password: string;
}

/** 이 브라우저에 저장해 둔 로그인 정보 (없으면 null) */
function parseSaved(raw: string | null): SavedLogin | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return { id: String(v?.id || ""), password: String(v?.password || "") };
  } catch {
    return null;
  }
}

function readSavedRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// 저장된 로그인 정보는 브라우저에만 있다. 서버 렌더링 때는 "없음"으로 그리고,
// 브라우저에서 읽은 값으로 폼을 다시 만든다(아래 key).
const subscribeNoop = () => () => {};

export default function LoginPage() {
  const savedRaw = useSyncExternalStore(subscribeNoop, readSavedRaw, () => null);
  return (
    <Suspense fallback={null}>
      <LoginForm key={savedRaw ?? ""} saved={parseSaved(savedRaw)} />
    </Suspense>
  );
}

function LoginForm({ saved }: { saved: SavedLogin | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [id, setId] = useState(saved?.id || "");
  const [password, setPassword] = useState(saved?.password || "");
  // 아이디 저장 / 비밀번호 저장은 따로 고른다. 비밀번호는 사용자가 직접 켠 경우에만 저장한다.
  const [rememberId, setRememberId] = useState(!!saved);
  const [rememberPassword, setRememberPassword] = useState(!!saved?.password);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 소셜 로그인 콜백이 돌려보낸 사유 (?error=). 직접 로그인을 시도하면 그 결과로 바뀐다.
  const socialErrorCode = searchParams.get("error");
  const socialError = socialErrorCode ? SOCIAL_ERRORS[socialErrorCode] || SOCIAL_ERROR_DEFAULT : "";
  const error = submitError ?? socialError;

  // 로그인 후 돌아갈 경로 (?next=, 상대경로만 허용 — 오픈 리다이렉트 방지). 소셜 로그인에도 이어 준다.
  const safeNext = safeNextPath(searchParams.get("next"));
  const nextQuery = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";

  function saveLoginChoice() {
    try {
      if (rememberId) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(rememberPassword ? { id, password } : { id }),
        );
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // 저장소를 쓸 수 없는 브라우저(사생활 보호 모드 등) — 저장만 건너뛴다
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", id, password }),
      });
      const data = await res.json();

      if (data.ok) {
        saveLoginChoice();
        // 거래처(company)는 로그인 후 메인페이지로 — 거기서 "주문하기"로 포털 진입
        router.push(safeNext ?? homeForRole(data.role));
      } else {
        setSubmitError(data.error || "로그인에 실패했습니다.");
      }
    } catch {
      setSubmitError("서버 연결에 실패했습니다.");
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
              placeholder="아이디"
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

          <div className="space-y-1.5">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberId"
                  checked={rememberId}
                  onChange={(e) => {
                    setRememberId(e.target.checked);
                    // 아이디를 저장하지 않으면 비밀번호도 저장하지 않는다
                    if (!e.target.checked) setRememberPassword(false);
                  }}
                  className="accent-primary"
                />
                <label htmlFor="rememberId" className="text-sm text-text-secondary">
                  아이디 저장
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberPassword"
                  checked={rememberPassword}
                  onChange={(e) => {
                    setRememberPassword(e.target.checked);
                    if (e.target.checked) setRememberId(true);
                  }}
                  className="accent-primary"
                />
                <label htmlFor="rememberPassword" className="text-sm text-text-secondary">
                  비밀번호도 저장
                </label>
              </div>
            </div>
            {rememberPassword && (
              <p className="text-xs text-yellow-400/90">
                비밀번호가 이 브라우저에 저장됩니다. 여럿이 쓰는 PC에서는 켜지 마세요.
              </p>
            )}
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
              href={`/api/auth/naver${nextQuery}`}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 text-white"
              style={{ backgroundColor: "#03C75A" }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M13.5 10.56L6.26 0H0v20h6.5V9.44L13.74 20H20V0h-6.5v10.56z" fill="white"/>
              </svg>
              네이버로 로그인
            </a>

            <a
              href={`/api/auth/kakao${nextQuery}`}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 text-[#191919]"
              style={{ backgroundColor: "#FEE500" }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 1C4.477 1 0 4.477 0 8.667c0 2.7 1.752 5.076 4.396 6.443l-1.12 4.11a.3.3 0 00.456.326l4.764-3.16c.487.05.983.076 1.504.076 5.523 0 10-3.477 10-7.795C20 4.477 15.523 1 10 1z" fill="#191919"/>
              </svg>
              카카오로 로그인
            </a>

            <a
              href={`/api/auth/google${nextQuery}`}
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
