import { Boxes, ClipboardList, Ticket, PiggyBank } from "lucide-react";

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
    icon: ClipboardList,
    title: "식단·급식관리 프로그램",
    desc: "식단표 작성·영양분석·발주 관리까지.\n1주일 무료 체험으로 먼저 사용해 보세요.",
    status: "체험 가능",
    statusColor: "bg-emerald-500/15 text-emerald-400",
    href: "#contact",
    cta: "1주일 무료 체험",
  },
  {
    icon: Ticket,
    title: "식권발행기",
    desc: "3인치 전용 프린터로 누구나 간편하게.\n빠르고 정확한 식권 발행 시스템.",
    status: "운영중",
    statusColor: "bg-emerald-500/15 text-emerald-400",
    href: "#contact",
    cta: "도입 문의",
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
