import { PiggyBank, Layers, Truck, MessageCircle } from "lucide-react";

const reasons = [
  {
    icon: PiggyBank,
    title: "원가절감",
    desc: "도매 직거래와 통합 운영으로\n급식 현장의 원가를 낮춥니다.",
  },
  {
    icon: Layers,
    title: "통합 운영",
    desc: "용기·식단관리·식권발행을\n한 곳에서 연결해 관리합니다.",
  },
  {
    icon: Truck,
    title: "빠른 배송",
    desc: "주문 확인 후 신속하게 발송하여\n현장에 차질이 없도록 합니다.",
  },
  {
    icon: MessageCircle,
    title: "직접 상담",
    desc: "카카오톡·전화·문자로 직접\n상담하여 맞춤 솔루션을 제안합니다.",
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
            왜 <span className="text-gradient">밀포인트</span> 급식포털인가
          </h2>
          <p className="text-text-secondary max-w-lg mx-auto">
            급식 현장의 운영과 비용, 한 번에 가볍게 만들어 드립니다.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
