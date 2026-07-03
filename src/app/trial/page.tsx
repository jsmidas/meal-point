"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
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
  | { kind: "entering" } // 인증 완료 → 배정·시스템 진입 자동 진행 중
  | { kind: "active"; account: Account; expiresAt: string } // TRIAL_URL 미설정 폴백
  | { kind: "full" };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const cautions = [
  "체험 환경은 여러 방문자가 함께 사용하는 하나의 시스템입니다. 다른 체험자가 입력한 데이터가 보이거나 수정될 수 있으니, 실제 운영 데이터나 개인정보(직원·거래처 연락처 등)는 입력하지 마세요.",
  "발주서·지시서 등 모든 문서는 체험용입니다. 실제 협력업체로 전송되지 않습니다.",
  "체험 계정은 발급 후 7일간 유효하며, 체험 데이터는 주기적으로 초기 상태로 복원됩니다. 작성한 내용은 보관되지 않습니다.",
  "기능 둘러보기 용도이며 일부 기능(백업·시스템 설정 등 관리자 기능)은 제한됩니다.",
];

export default function TrialPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  // 체험 사이트로 자동 진입 (u/p 파라미터 = 원클릭 자동 로그인).
  // TRIAL_URL 미설정이면 폴백으로 계정 카드를 보여준다.
  function enterTrial(account: Account, expiresAt: string): boolean {
    if (!TRIAL_URL) {
      setState({ kind: "active", account, expiresAt });
      return false;
    }
    window.location.href = `${TRIAL_URL}?u=${encodeURIComponent(account.login_id)}&p=${encodeURIComponent(account.login_pw)}`;
    return true;
  }

  useEffect(() => {
    // 카카오 인증이 끝나 있으면 배정~시스템 진입까지 사람 손 없이 이어진다:
    // 인증됨+사용권 있음 → 즉시 이동 / 인증됨+미발급 → 자동 배정 후 이동
    fetch("/api/trial")
      .then((r) => r.json())
      .then((d) => {
        if (!d.authenticated) setState({ kind: "guest" });
        else if (d.status === "active") {
          if (!enterTrial(d.account, d.expiresAt)) return;
          setState({ kind: "entering" });
        } else {
          setState({ kind: "entering" });
          void startTrial();
        }
      })
      .catch(() => setState({ kind: "guest" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startTrial() {
    try {
      const res = await fetch("/api/trial", { method: "POST" });
      const d = await res.json();
      if (res.status === 401) {
        setState({ kind: "guest" });
        return;
      }
      if (d.status === "full") setState({ kind: "full" });
      else if (d.status === "active") {
        if (!enterTrial(d.account, d.expiresAt)) return;
        setState({ kind: "entering" });
      }
    } catch {
      setState({ kind: "guest" });
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

          {state.kind === "entering" && (
            <div className="text-center py-8">
              <Loader2 className="animate-spin mx-auto mb-4 text-primary" size={28} />
              <p className="text-text-primary font-semibold mb-1">인증 완료 — 체험 계정을 배정하고 있습니다</p>
              <p className="text-text-secondary text-sm">잠시 후 식단관리 시스템으로 자동 이동합니다...</p>
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
                  /* u/p 파라미터 = 체험 사이트 원클릭 자동 로그인 (login.html 이 읽어 즉시 로그인 후 주소에서 제거) */
                  href={`${TRIAL_URL}?u=${encodeURIComponent(state.account.login_id)}&p=${encodeURIComponent(state.account.login_pw)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
                >
                  체험 시작하기 — 클릭 한 번으로 자동 로그인 <ExternalLink size={16} />
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
