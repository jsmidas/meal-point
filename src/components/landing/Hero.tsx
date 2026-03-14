export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
        <p className="text-sm tracking-widest text-primary font-medium mb-4 uppercase">
          급식 용기, 식단프로그램, 식권발행기 등 대표님들의 원가절감과 원활한 운영을 적극 도와 드립니다. Meals Total Solution
        </p>
        <h1 className="text-4xl md:text-6xl font-black text-text-primary leading-tight mb-6">
          급식/도시락 
         <br />
          <span className="text-gradient">Total Solution</span>
        </h1>
        <p className="text-lg text-text-secondary mb-10 leading-relaxed">
          재료비 절감 solution, 식권발행기, 각종용기(내피부터 발열제까지),
          <br className="hidden md:block" />
           합리적인 가격과 빠른 배송으로 급식 현장의 파트너가 되겠습니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#products"
            className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors"
          >
            제품 보기
          </a>
          <a
            href="#contact"
            className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-border-light text-text-primary font-semibold hover:bg-white/5 transition-colors"
          >
            문의하기
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted">
        <span className="text-xs tracking-widest uppercase">scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-text-muted to-transparent" />
      </div>
    </section>
  );
}
