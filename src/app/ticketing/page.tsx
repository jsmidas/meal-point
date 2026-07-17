import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  MonitorCheck,
  Building2,
  BarChart3,
  Printer,
  Zap,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "식권발행기 소개 | 밀포인트",
  description:
    "터치 몇 번으로 식권 발행, 발행 내역은 그대로 정산까지 — 실제 화면으로 미리 보는 밀포인트 식권발행기.",
};

type Screen = {
  icon: LucideIcon;
  step: string;
  tag: string;
  title: string;
  desc: string;
  image: string;
  alt: string;
};

// 화면별 소개 — 이미지마다 사용법 중심의 두 줄 설명
const screens: Screen[] = [
  {
    icon: MonitorCheck,
    step: "01",
    tag: "발권 화면",
    title: "누구나 터치 몇 번이면 발권 끝",
    desc: "사원번호를 입력하고 끼니 버튼을 누르면 식권이 바로 출력됩니다.\n끼니별 발권 현황이 화면 위에 실시간으로 집계되어 표시됩니다.",
    image: "/images/ticket/kiosk-main.jpg",
    alt: "식권발행기 발권 화면 — 사원 검색과 끼니 선택 버튼",
  },
  {
    icon: Building2,
    step: "02",
    tag: "중앙 관리자",
    title: "여러 사업장을 한 화면에서 관리",
    desc: "사업장마다 흩어진 발권기를 중앙 대시보드에서 한눈에 봅니다.\n사업장별 온라인 상태와 오늘 발권 수가 실시간으로 동기화됩니다.",
    image: "/images/ticket/admin-dashboard.png",
    alt: "관리자 대시보드 — 사업장별 발권 현황과 동기화 상태",
  },
  {
    icon: BarChart3,
    step: "03",
    tag: "통합 리포트",
    title: "발행 내역이 그대로 정산 자료로",
    desc: "사업장별·부서별·개인별·일별 발권 집계를 조건만 골라 조회합니다.\n금액까지 합산되고 CSV로 내려받아 급여·정산 자료로 바로 씁니다.",
    image: "/images/ticket/admin-report.png",
    alt: "통합 리포트 — 사업장별 발권 집계와 금액, CSV 다운로드",
  },
];

const highlights = [
  {
    icon: Printer,
    title: "3인치 전용 프린터",
    desc: "현장 발권에 최적화된 감열 프린터. 영수증처럼 빠르게 출력됩니다.",
  },
  {
    icon: Zap,
    title: "설치형 · 오프라인 안심",
    desc: "PC에 설치해 쓰는 프로그램이라 인터넷이 잠시 끊겨도 발권은 계속됩니다.",
  },
  {
    icon: ShieldCheck,
    title: "기록이 곧 정산",
    desc: "발행 한 건 한 건이 서버에 기록되어 식수 집계·정산이 자동으로 맞습니다.",
  },
];

export default function TicketingPage() {
  return (
    <div className="min-h-screen bg-bg-dark">
      {/* 미니 헤더 */}
      <header className="border-b border-border sticky top-0 z-20 bg-bg-dark/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-text-primary">
            밀포인트
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              ← 홈으로
            </Link>
            <Link
              href="/#contact"
              className="px-4 py-2 rounded-lg bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
            >
              도입 문의
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* 소개 + 대표 이미지 */}
        <div className="text-center mb-10">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            Food Ticket
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            식권 발행부터 정산까지,{" "}
            <span className="text-gradient">화면으로 미리 보기</span>
          </h1>
          <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">
            현장은 터치 모니터와 3인치 전용 프린터면 준비 끝. 발행 내역은 웹
            관리자 화면으로 모여 여러 사업장 현황부터 정산 리포트까지 한 곳에서
            관리됩니다.
          </p>
        </div>

        <div className="mb-16 rounded-2xl border border-border bg-bg-card overflow-hidden">
          <Image
            src="/images/ticket/machine.png"
            alt="식권발행기 구성 — 터치 모니터와 3인치 전용 프린터"
            width={1262}
            height={918}
            sizes="(max-width: 1024px) 100vw, 960px"
            className="w-full h-auto"
            priority
          />
          <p className="px-6 py-4 text-sm text-text-muted text-center border-t border-border">
            터치 모니터 + 3인치 감열 프린터 구성 — 화면 속이 실제 발권
            프로그램입니다
          </p>
        </div>

        {/* 특장점 */}
        <div className="grid sm:grid-cols-3 gap-6 mb-20">
          {highlights.map((h) => (
            <div
              key={h.title}
              className="rounded-2xl border border-border bg-bg-card p-7 text-center"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <h.icon className="text-primary" size={28} />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">
                {h.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {h.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 화면별 소개 — 이미지 + 두 줄 설명 */}
        <div className="space-y-20">
          {screens.map((s, i) => (
            <section
              key={s.step}
              className={`flex flex-col gap-8 lg:items-center ${
                i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
              }`}
            >
              {/* 설명 */}
              <div className="lg:w-[38%] shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <s.icon className="text-primary" size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary tracking-widest">
                      STEP {s.step}
                    </p>
                    <p className="text-sm font-medium text-text-muted">
                      {s.tag}
                    </p>
                  </div>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">
                  {s.title}
                </h2>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">
                  {s.desc}
                </p>
              </div>

              {/* 스크린샷 */}
              <div className="lg:w-[62%]">
                <div className="rounded-xl border border-border overflow-hidden shadow-2xl bg-bg-card">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-bg-card">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                    <span className="ml-3 text-xs text-text-muted truncate">
                      {s.tag}
                    </span>
                  </div>
                  <Image
                    src={s.image}
                    alt={s.alt}
                    width={1440}
                    height={900}
                    sizes="(max-width: 1024px) 100vw, 640px"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* 하단 CTA */}
        <div className="mt-24 rounded-2xl border border-border bg-bg-card p-10 text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-3">
            우리 현장에 맞을지 궁금하다면
          </h2>
          <p className="text-text-secondary mb-8 max-w-xl mx-auto">
            식수 규모와 운영 방식을 알려주시면 설치 구성과 비용을 안내해
            드립니다. 프린터·모니터 등 하드웨어까지 한 번에 준비됩니다.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors"
            >
              도입 문의하기 →
            </Link>
            <Link
              href="/#ticketing"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-border text-text-primary font-semibold hover:bg-bg-card-hover transition-colors"
            >
              제품 보러가기
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-text-muted">
        © {new Date().getFullYear()} 밀포인트 급식포털
      </footer>
    </div>
  );
}
