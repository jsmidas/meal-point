import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  Ticket,
  PiggyBank,
  Users,
  CalendarDays,
  Sparkles,
  ShoppingCart,
} from "lucide-react";

// 식단·급식관리 프로그램 핵심 기능 (대표 카드에 노출, 업무 흐름 순)
const programFeatures = [
  { icon: Users, label: "식수 계획", desc: "사업장·끼니별 등록" },
  { icon: CalendarDays, label: "식단표 작성", desc: "달력에서 클릭으로" },
  { icon: Sparkles, label: "AI 메뉴편성", desc: "일주일 초안 자동 (선택)" },
  { icon: ShoppingCart, label: "발주 자동계산", desc: "식수 × 식단 = 발주량" },
];

const services = [
  {
    icon: Boxes,
    title: "발열도시락 · 급식용기 도소매",
    desc: "내피·외피·발열제·필름부터 발열도시락까지.\n낱개부터 대량까지 도매가로 공급합니다.",
    status: "운영중",
    statusColor: "bg-emerald-500/15 text-emerald-400",
    href: "#products",
    cta: "제품 보기",
  },
  {
    icon: Ticket,
    title: "식권발행기",
    desc: "3인치 전용 프린터로 누구나 간편하게.\n빠르고 정확한 식권 발행 시스템.",
    status: "운영중",
    statusColor: "bg-emerald-500/15 text-emerald-400",
    href: "#ticketing",
    cta: "자세히 보기",
  },
  {
    icon: PiggyBank,
    title: "원가절감 통합 상담",
    desc: "용기·식단·운영을 한 곳에서.\n현장에 맞는 원가절감 방안을 제안합니다.",
    status: "운영중",
    statusColor: "bg-emerald-500/15 text-emerald-400",
    href: "#contact",
    cta: "상담 신청",
  },
];

export default function Services() {
  return (
    <section id="services" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            SERVICES
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            급식 현장의 모든 것을{" "}
            <span className="text-gradient">한 곳에서</span>
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            용기 공급부터 식단관리·식권발행까지, 밀포인트 급식포털이 함께합니다.
          </p>
        </div>

        {/* 대표 서비스: 식단·급식관리 프로그램 — 실제 화면과 함께 */}
        <div className="mb-6 rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="grid lg:grid-cols-2">
            {/* 왼쪽: 설명 */}
            <div className="p-8 lg:p-10 flex flex-col">
              <div className="flex items-center gap-2 mb-5">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                  체험 가능
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent">
                  1주일 무료
                </span>
              </div>
              <h3 className="text-2xl font-bold text-text-primary mb-3">
                식단·급식관리 프로그램
              </h3>
              <p className="text-text-secondary leading-relaxed mb-7">
                식단표 작성부터 AI 메뉴편성, 발주서 자동 계산까지 —{" "}
                급식 실무의 하루가 이 프로그램 안에서 끝납니다.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {programFeatures.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-start gap-3 rounded-xl border border-border bg-bg-dark/50 p-3.5"
                  >
                    <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <f.icon className="text-primary" size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {f.label}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap gap-3">
                <Link
                  href="/program"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
                >
                  화면으로 미리보기 →
                </Link>
                <Link
                  href="/trial"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-border text-text-primary font-semibold text-sm hover:bg-bg-card-hover transition-colors"
                >
                  1주일 무료 체험
                </Link>
              </div>
            </div>

            {/* 오른쪽: 실제 프로그램 화면 */}
            <Link
              href="/program"
              className="group relative block bg-bg-dark/60 p-6 lg:p-8 lg:pl-0"
            >
              <div className="relative h-full min-h-[260px] rounded-xl border border-border overflow-hidden shadow-2xl">
                <Image
                  src="/images/program/mealplan.png"
                  alt="식단·급식관리 프로그램 — 월간 식단 달력 화면"
                  fill
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="object-cover object-left-top group-hover:scale-[1.02] transition-transform duration-500"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-dark/90 to-transparent p-4 pt-10">
                  <p className="text-sm text-text-secondary">
                    실제 운영 화면 — 한 달 식단이 달력 하나에
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* 나머지 서비스 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s) => (
            <a
              key={s.title}
              href={s.href}
              className="group flex flex-col rounded-2xl border border-border bg-bg-card p-7 hover:bg-bg-card-hover hover:border-border-light transition-all"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <s.icon className="text-primary" size={28} />
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.statusColor}`}
                >
                  {s.status}
                </span>
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-3">
                {s.title}
              </h3>
              <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed flex-1">
                {s.desc}
              </p>
              <span className="mt-5 inline-flex items-center text-sm font-medium text-primary">
                {s.cta}
                <span className="ml-1 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
