import { Ticket, Truck, MessageCircle } from "lucide-react";

const reasons = [
  {
    icon: Ticket,
    title: "전국 최저가",
    desc: "도매 직거래로 중간 마진 없이\n전국 최저가를 보장합니다.",
  },
  {
    icon: Truck,
    title: "빠른 배송",
    desc: "주문 확인 후 신속하게 발송하여\n현장에 차질이 없도록 합니다.",
  },
  {
    icon: MessageCircle,
    title: "직접 상담",
    desc: "카카오톡, 전화, 문자로 직접\n상담하여 맞춤 견적을 제공합니다.",
  },
];

export default function WhySection() {
  return (
    <section id="why" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            WHY MEALPOINT
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            <span className="text-gradient">전국 최저가</span>로 급식 용기를
            공급합니다
          </h2>
          <p className="text-text-secondary max-w-lg mx-auto">
            같은 제품, 어디보다 합리적인 가격 — 직접 비교해보세요.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {reasons.map((r) => (
            <div
              key={r.title}
              className="group rounded-2xl border border-border bg-bg-card p-8 hover:bg-bg-card-hover hover:border-border-light transition-all"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <r.icon className="text-primary" size={28} />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">
                {r.title}
              </h3>
              <p className="text-text-secondary whitespace-pre-line leading-relaxed">
                {r.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
