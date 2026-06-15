"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  KeyRound,
  Clock,
  ExternalLink,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";

const TRIAL_URL = process.env.NEXT_PUBLIC_MEAL_PLAN_TRIAL_URL || "";

type Account = { login_id: string; login_pw: string };
type State =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "eligible" }
  | { kind: "active"; account: Account; expiresAt: string }
  | { kind: "full" };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const cautions = [
  "체험 계정은 여러 방문자가 함께 사용하는 환경입니다. 실제 운영 데이터나 민감한 개인정보는 입력하지 마세요.",
  "체험 데이터는 사용권 만료(발급 후 7일) 시 자동으로 초기화됩니다.",
  "기능 둘러보기 용도이며, 일부 기능은 제한될 수 있습니다.",
];

export default function TrialPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch("/api/trial")
      .then((r) => r.json())
      .then((d) => {
        if (!d.authenticated) setState({ kind: "guest" });
        else if (d.status === "active") setState({ kind: "active", account: d.account, expiresAt: d.expiresAt });
        else setState({ kind: "eligible" });
      })
      .catch(() => setState({ kind: "guest" }));
  }, []);

  async function startTrial() {
    setStarting(true);
    try {
      const res = await fetch("/api/trial", { method: "POST" });
      const d = await res.json();
      if (res.status === 401) {
        setState({ kind: "guest" });
        return;
      }
      if (d.status === "full") setState({ kind: "full" });
      else if (d.status === "active") setState({ kind: "active", account: d.account, expiresAt: d.expiresAt });
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-dark">
      {/* 미니 헤더 */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-text-primary">밀포인트</Link>
          <Link href="/" className="text-sm text-text-muted hover:text-text-primary transition-colors">← 홈으로</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* 소개 */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <ClipboardList className="text-primary" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-3">식단·급식관리 프로그램 무료 체험</h1>
          <p className="text-text-secondary max-w-xl mx-auto leading-relaxed">
            카카오 인증 한 번이면 1주일 동안 식단표 작성·영양분석·발주 관리를 직접 사용해 볼 수 있습니다.
          </p>
        </div>

        {/* 본문 카드 */}
        <div className="rounded-2xl border border-border bg-bg-card p-8">
          {state.kind === "loading" && (
            <div className="flex items-center justify-center py-10 text-text-muted">
              <Loader2 className="animate-spin mr-2" size={20} /> 확인 중...
            </div>
          )}

          {state.kind === "guest" && (
            <div className="text-center py-4">
              <p className="text-text-secondary mb-6">
                무료 체험을 시작하려면 카카오 인증이 필요합니다.<br />
                인증 후 체험 계정이 자동으로 배정됩니다.
              </p>
              <a
                href="/api/auth/kakao?next=/trial"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-[#191919]"
                style={{ backgroundColor: "#FEE500" }}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M10 1C4.477 1 0 4.477 0 8.667c0 2.7 1.752 5.076 4.396 6.443l-1.12 4.11a.3.3 0 00.456.326l4.764-3.16c.487.05.983.076 1.504.076 5.523 0 10-3.477 10-7.795C20 4.477 15.523 1 10 1z" fill="#191919" />
                </svg>
                카카오로 인증하고 체험 시작
              </a>
            </div>
          )}

          {state.kind === "eligible" && (
            <div className="text-center py-4">
              <p className="text-text-secondary mb-6">
                인증이 완료되었습니다. 아래 버튼을 누르면 체험 계정이 배정되고 1주일간 사용할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={startTrial}
                disabled={starting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {starting ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
                {starting ? "계정 배정 중..." : "체험 시작하기"}
              </button>
            </div>
          )}

          {state.kind === "active" && (
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-4">
                <Clock size={16} /> {formatDate(state.expiresAt)}까지 이용 가능
              </div>
              <p className="text-text-secondary text-sm mb-4">아래 계정으로 식단관리 프로그램에 로그인하세요.</p>
              <div className="rounded-xl border border-border bg-bg-dark p-5 mb-6 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-muted">아이디</span>
                  <span className="font-mono font-semibold text-text-primary select-all">{state.account.login_id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-muted">비밀번호</span>
                  <span className="font-mono font-semibold text-text-primary select-all">{state.account.login_pw}</span>
                </div>
              </div>
              {TRIAL_URL ? (
                <a
                  href={TRIAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
                >
                  식단관리 프로그램 바로가기 <ExternalLink size={16} />
                </a>
              ) : (
                <a
                  href="/#contact"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-bg-card-hover text-text-secondary font-semibold text-sm border border-border"
                >
                  체험 사이트 준비 중 — 문의하기
                </a>
              )}
            </div>
          )}

          {state.kind === "full" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-yellow-400" size={28} />
              </div>
              <p className="text-text-primary font-semibold mb-2">현재 체험 정원이 모두 찼습니다</p>
              <p className="text-text-secondary text-sm">
                기존 체험이 만료되면 자리가 생깁니다. 잠시 후 다시 시도해 주세요.
              </p>
            </div>
          )}
        </div>

        {/* 주의사항 */}
        <div className="mt-8 rounded-2xl border border-border bg-bg-card/50 p-6">
          <div className="flex items-center gap-2 text-text-primary font-semibold text-sm mb-3">
            <ShieldAlert size={16} className="text-primary" /> 로그인 전 알아두세요
          </div>
          <ul className="space-y-2">
            {cautions.map((c, i) => (
              <li key={i} className="text-sm text-text-secondary flex gap-2">
                <span className="text-primary">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
