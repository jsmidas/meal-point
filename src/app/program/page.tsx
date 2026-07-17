import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  Sparkles,
  UtensilsCrossed,
  Scale,
  ShoppingCart,
  ChefHat,
  Printer,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

type Screen = {
  icon: LucideIcon;
  step: string;
  tag: string;
  badge?: string;
  title: string;
  desc: string;
  note?: string;
  image: string;
  alt: string;
};

export const metadata: Metadata = {
  title: "식단·급식관리 프로그램 소개 | 밀포인트",
  description:
    "식단표 작성, AI 메뉴편성, 발주 자동 계산까지 — 실제 화면으로 미리 보는 밀포인트 식단·급식관리 프로그램.",
};

// 화면별 소개 — 이미지마다 사용법 중심의 두 줄 설명
const screens: Screen[] = [
  {
    icon: Users,
    step: "01",
    tag: "식수 관리",
    title: "하루의 시작은 식수 계획부터",
    desc: "사업장별·끼니별로 계획 식수를 등록하고, 마감 후 실적을 입력합니다.\n전날 복사·일괄 입력으로 금방 끝나고, 이 숫자가 뒤의 발주량 계산 기준이 됩니다.",
    image: "/images/program/mealcount.png",
    alt: "식수 관리 — 사업장별 계획·실적 식수를 등록하는 화면",
  },
  {
    icon: CalendarDays,
    step: "02",
    tag: "식단 관리",
    title: "한 달 식단이 달력 하나에",
    desc: "달력에서 날짜를 고르고 메뉴를 담으면 식단표가 완성됩니다.\n끼니별 식수와 메뉴 개수가 한눈에 보여 빠진 날을 놓치지 않습니다.",
    image: "/images/program/mealplan.png",
    alt: "식단 관리 — 월간 달력에 끼니별 식단과 식수가 표시된 화면",
  },
  {
    icon: Sparkles,
    step: "03",
    tag: "AI 메뉴편성",
    badge: "선택 기능",
    title: "AI가 일주일 식단 초안을 자동 편성",
    desc: "판매단가와 목표 재료비율만 입력하면 AI가 일주일 식단을 제안합니다.\n현재 식자재 단가로 재료비까지 검증해 목표 원가에 맞춰 줍니다.",
    note: "AI 편성은 선택 사항입니다 — 사용하지 않고 직접 식단을 짜도 모든 기능을 그대로 쓸 수 있습니다.",
    image: "/images/program/ai-menu.png",
    alt: "AI 메뉴편성 — 편성 조건을 입력하는 화면",
  },
  {
    icon: UtensilsCrossed,
    step: "04",
    tag: "메뉴/레시피 관리",
    title: "레시피를 담으면 원가가 자동 계산",
    desc: "레시피에 식자재를 담으면 1인 필요량과 재료비가 바로 계산됩니다.\n기존 레시피는 엑셀 대량 업로드로 한 번에 옮길 수 있습니다.",
    image: "/images/program/recipe.png",
    alt: "메뉴/레시피 관리 — 식자재 구성과 1인 재료비가 계산된 화면",
  },
  {
    icon: Scale,
    step: "05",
    tag: "일자별 가격 점검",
    title: "더 싼 식자재를 자동으로 찾아 절감",
    desc: "그날 식단의 식자재마다 더 저렴한 대안을 자동 추천합니다.\n클릭 한 번으로 교체하면 예상 식재료비가 즉시 다시 계산됩니다.",
    image: "/images/program/price-check.png",
    alt: "일자별 가격 점검 — 메뉴별 절감 가능 식자재가 표시된 화면",
  },
  {
    icon: ShoppingCart,
    step: "06",
    tag: "발주 관리",
    title: "식수 × 식단 = 발주량, 자동으로",
    desc: "식단과 식수를 곱해 품목별 발주량을 자동 계산합니다.\n협력업체별로 발주서가 만들어지고, 발주 불가 품목은 미리 경고합니다.",
    image: "/images/program/ordering.png",
    alt: "발주 관리 — 품목별 발주량과 단가가 계산된 화면",
  },
  {
    icon: ChefHat,
    step: "07",
    tag: "지시서 관리",
    title: "주방에 내리는 지시서, 자동으로 3종",
    desc: "확정된 식단과 식수로 전처리·조리·소분 지시서가 자동 생성됩니다.\n메뉴별 재료 총량이 계산돼 나오니, 주방은 출력물 한 장으로 바로 움직입니다.",
    image: "/images/program/instruction.png",
    alt: "조리지시서 — 메뉴별 재료와 총량이 자동 계산된 화면",
  },
  {
    icon: Printer,
    step: "08",
    tag: "식단표 출력",
    title: "배포용 식단표를 바로 출력",
    desc: "완성된 식단에 배경과 로고를 입혀 보기 좋은 식단표로 만듭니다.\nA4 가로·세로, 모바일용까지 PDF·이미지로 바로 저장됩니다.",
    image: "/images/program/print.png",
    alt: "식단표 출력 — 주간 식단표 미리보기 화면",
  },
  {
    icon: LayoutDashboard,
    step: "09",
    tag: "대시보드",
    title: "출근하면 대시보드부터",
    desc: "발주 누락, 단가 만료, 오늘 식수를 첫 화면에서 바로 확인합니다.\n놓치면 사고가 되는 일들을 프로그램이 먼저 알려 줍니다.",
    image: "/images/program/dashboard.png",
    alt: "대시보드 — 발주 경고와 식재료비 추이가 표시된 화면",
  },
];

export default function ProgramPage() {
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
              href="/trial"
              className="px-4 py-2 rounded-lg bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
            >
              무료 체험
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* 소개 */}
        <div className="text-center mb-14">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            Meal Program
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            식단 작성부터 발주까지,{" "}
            <span className="text-gradient">화면으로 미리 보기</span>
          </h1>
          <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">
            아래는 실제 운영 중인 프로그램 화면입니다. 급식 실무의 하루 흐름
            그대로 — 식단을 만들고, 원가를 점검하고, 발주서를 뽑는 과정을
            따라가며 살펴보세요.
          </p>
        </div>

        {/* 업무 흐름 요약 */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-16 text-sm">
          {["식수 계획", "식단 작성", "AI 편성(선택)", "원가 점검", "발주", "지시서", "식단표 출력"].map(
            (label, i, arr) => (
              <span key={label} className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-full border border-border bg-bg-card text-text-secondary font-medium">
                  {label}
                </span>
                {i < arr.length - 1 && (
                  <span className="text-text-muted">→</span>
                )}
              </span>
            )
          )}
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
                    <p className="text-sm font-medium text-text-muted flex items-center gap-2">
                      {s.tag}
                      {s.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/15 text-accent">
                          {s.badge}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">
                  {s.title}
                </h2>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">
                  {s.desc}
                </p>
                {s.note && (
                  <p className="mt-3 text-sm text-text-muted leading-relaxed">
                    ※ {s.note}
                  </p>
                )}
              </div>

              {/* 스크린샷 */}
              <div className="lg:w-[62%]">
                <div className="rounded-xl border border-border overflow-hidden shadow-2xl bg-bg-card">
                  {/* 브라우저 프레임 */}
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
            직접 써 보는 게 가장 빠릅니다
          </h2>
          <p className="text-text-secondary mb-8 max-w-xl mx-auto">
            카카오 인증 한 번이면 위 화면 그대로 1주일 동안 무료로 사용할 수
            있습니다. 설치도, 카드 등록도 필요 없습니다.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/trial"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors"
            >
              1주일 무료 체험 시작 →
            </Link>
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-border text-text-primary font-semibold hover:bg-bg-card-hover transition-colors"
            >
              도입 상담하기
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
