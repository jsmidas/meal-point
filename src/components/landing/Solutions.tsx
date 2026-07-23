import Image from "next/image";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  Sparkles,
  ShoppingCart,
  Printer,
  Zap,
  ShieldCheck,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  label: string;
}

interface Solution {
  badges: { label: string; color: string }[];
  title: string;
  desc: string;
  priceNote?: string;
  features: Feature[];
  image: string;
  imageAlt: string;
  imageCaption: string;
  href: string;
  primaryCta: string;
  secondary: { href: string; label: string };
}

const solutions: Solution[] = [
  {
    badges: [
      { label: "체험 가능", color: "bg-emerald-500/15 text-emerald-400" },
      { label: "1주일 무료", color: "bg-accent/15 text-accent" },
    ],
    title: "식단·급식관리 프로그램",
    desc: "식단표 작성부터 AI 메뉴편성, 발주서 자동 계산까지 — 급식 실무의 하루가 이 프로그램 안에서 끝납니다.",
    features: [
      { icon: Users, label: "식수 계획" },
      { icon: CalendarDays, label: "식단표 작성" },
      { icon: Sparkles, label: "AI 메뉴편성" },
      { icon: ShoppingCart, label: "발주 자동계산" },
    ],
    image: "/images/program/mealplan.png",
    imageAlt: "식단·급식관리 프로그램 — 월간 식단 달력 화면",
    imageCaption: "실제 운영 화면 — 한 달 식단이 달력 하나에",
    href: "/program",
    primaryCta: "화면으로 미리보기",
    secondary: { href: "/trial", label: "1주일 무료 체험" },
  },
  {
    badges: [{ label: "운영중", color: "bg-emerald-500/15 text-emerald-400" }],
    title: "식권발행기",
    desc: "현장은 터치 모니터 + 3인치 전용 프린터, 관리는 웹에서. 발행 내역이 실시간 집계되어 여러 사업장 현황과 정산 리포트까지 한 곳에서 관리됩니다.",
    priceNote: "매월 3만원으로 식권 프로그램을 이용하세요. (키보드용일 경우)",
    features: [
      { icon: Printer, label: "3인치 전용 프린터" },
      { icon: Zap, label: "터치 몇 번에 발권" },
      { icon: ShieldCheck, label: "식수·정산 자동 집계" },
    ],
    image: "/images/ticket/machine.png",
    imageAlt: "식권발행기 구성 — 터치 모니터와 3인치 전용 프린터",
    imageCaption: "화면 속이 실제 발권 프로그램입니다",
    href: "/ticketing",
    primaryCta: "화면으로 미리보기",
    secondary: { href: "#contact", label: "도입 문의" },
  },
];

export default function Solutions() {
  return (
    <section id="solutions" className="py-24 bg-bg-dark/40">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            SOLUTIONS
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            운영까지 책임지는 <span className="text-gradient">급식 솔루션</span>
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            용기 공급에 더해, 식단관리와 식권발행까지 밀포인트가 함께합니다.
            카드를 눌러 실제 화면으로 확인하세요.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {solutions.map((s) => (
            <div
              key={s.title}
              className="flex flex-col rounded-2xl border border-border bg-bg-card overflow-hidden hover:border-border-light transition-all"
            >
              {/* 실제 화면 미리보기 */}
              <Link href={s.href} className="group relative block">
                <div className="relative aspect-[16/9] overflow-hidden bg-bg-dark">
                  <Image
                    src={s.image}
                    alt={s.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 560px"
                    className="object-cover object-left-top group-hover:scale-[1.02] transition-transform duration-500"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-dark/90 to-transparent p-4 pt-10">
                    <p className="text-sm text-text-secondary">{s.imageCaption}</p>
                  </div>
                </div>
              </Link>

              <div className="flex flex-col flex-1 p-7">
                <div className="flex items-center gap-2 mb-4">
                  {s.badges.map((b) => (
                    <span
                      key={b.label}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${b.color}`}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
                <h3 className="text-xl font-bold text-text-primary mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-5">
                  {s.desc}
                </p>

                {s.priceNote && (
                  <p className="mb-5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                    {s.priceNote}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-7">
                  {s.features.map((f) => (
                    <span
                      key={f.label}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-dark/50 px-3 py-1.5 text-xs font-medium text-text-primary"
                    >
                      <f.icon className="text-primary" size={14} />
                      {f.label}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap gap-3">
                  <Link
                    href={s.href}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
                  >
                    {s.primaryCta} →
                  </Link>
                  <a
                    href={s.secondary.href}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-border text-text-primary font-semibold text-sm hover:bg-bg-card-hover transition-colors"
                  >
                    {s.secondary.label}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 원가절감 통합 상담 */}
        <a
          href="#contact"
          className="group mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-border bg-bg-card p-6 hover:bg-bg-card-hover hover:border-border-light transition-all"
        >
          <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <PiggyBank className="text-primary" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-text-primary mb-1">
              원가절감 통합 상담
            </h3>
            <p className="text-sm text-text-secondary">
              용기·식단·운영을 한 곳에서. 현장에 맞는 원가절감 방안을 제안합니다.
            </p>
          </div>
          <span className="inline-flex items-center text-sm font-medium text-primary shrink-0">
            상담 신청
            <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </span>
        </a>
      </div>
    </section>
  );
}
