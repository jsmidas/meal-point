import Image from "next/image";

const steps = [
  {
    num: "01",
    title: "120ml의 마법",
    desc: "종이컵 한 컵(120ml) 분량의 물을 용기에 가볍게 부어주세요.",
  },
  {
    num: "02",
    title: "단 5분의 기다림",
    desc: "발열제가 안전하게 반응을 시작합니다. 딱 5분만 기다려주세요.",
  },
  {
    num: "03",
    title: "따뜻한 식사 완성",
    desc: "모락모락 김이 나는, 갓 지은 듯한 따뜻하고 든든한 식사를 즐기세요.",
  },
];

export default function HeatingDemo() {
  return (
    <section id="demo" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Image */}
          <div className="relative aspect-square max-w-md mx-auto lg:mx-0 rounded-2xl overflow-hidden">
            <Image
              src="/images/발열제와 물120ml.jpg"
              alt="발열도시락 물 붓는 시연"
              fill
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          {/* Text */}
          <div>
            <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
              HEATING DEMO
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4 leading-tight">
              점심시간 5분,
              <br />
              <span className="text-gradient">가장 따뜻한 휴식</span>
            </h2>
            <p className="text-text-secondary mb-10 leading-relaxed">
              바쁜 일상 속, 종이컵 한 컵의 물(120ml)만 부어주세요. 5분 후 갓 지은
              듯한 따뜻한 식사가 당신을 기다립니다.
            </p>

            <div className="space-y-6">
              {steps.map((step) => (
                <div key={step.num} className="flex gap-5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {step.num}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-text-primary mb-1">
                      {step.title}
                    </h4>
                    <p className="text-text-secondary text-sm leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
