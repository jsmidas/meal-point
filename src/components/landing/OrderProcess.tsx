import { FileText, User, Clock, CreditCard } from "lucide-react";

const steps = [
  {
    icon: FileText,
    title: "문의",
    desc: "카톡/전화/문자로\n편하게 연락주세요",
  },
  {
    icon: User,
    title: "수량 상담",
    desc: "필요한 제품과\n수량을 상담합니다",
  },
  {
    icon: Clock,
    title: "견적 확인",
    desc: "수량에 맞는\n견적을 안내드립니다",
  },
  {
    icon: CreditCard,
    title: "주문/배송",
    desc: "결제 확인 후\n신속하게 배송합니다",
  },
];

export default function OrderProcess() {
  return (
    <section id="process" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            ORDER PROCESS
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            간편한 <span className="text-gradient">주문 프로세스</span>
          </h2>
          <p className="text-text-secondary">
            4단계로 쉽고 빠르게 주문하세요.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={step.title} className="relative text-center">
              {/* Connector line (hidden on first item and mobile) */}
              {i > 0 && (
                <div className="hidden lg:block absolute top-8 -left-3 w-6 h-px bg-border-light" />
              )}
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <step.icon className="text-primary" size={28} />
              </div>
              <h4 className="text-lg font-bold text-text-primary mb-2">
                {step.title}
              </h4>
              <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
