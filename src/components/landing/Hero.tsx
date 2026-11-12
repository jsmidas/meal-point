/** 히어로: 홍보 영상을 전체 배경으로 깔고(음소거 자동재생), 글이 한 줄씩 떠오른다. (시안) */
export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
    >
      {/* 배경 영상 — 천천히 확대되는 움직임 */}
      <video
        className="absolute inset-0 w-full h-full object-cover hero-zoom"
        src="/videos/hero-bg.mp4"
        poster="/videos/hero-bg-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      {/* 글이 읽히도록 어둡게 덮기 */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-dark/80 via-bg-dark/55 to-bg-dark" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/15 blur-[140px] hero-pulse" />

      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
        <p className="hero-rise text-sm tracking-widest text-primary font-medium mb-4 uppercase" style={{ animationDelay: "0.1s" }}>
          Meal Total Solution · 급식포털
        </p>
        <h1 className="text-4xl md:text-6xl font-black text-text-primary leading-tight mb-6 drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]">
          <span className="hero-rise block" style={{ animationDelay: "0.3s" }}>발열도시락·급식용기,</span>
          <span className="hero-rise block text-gradient" style={{ animationDelay: "0.55s" }}>도매가로 한 번에</span>
        </h1>
        <p className="hero-rise text-lg text-text-primary/85 mb-10 leading-relaxed" style={{ animationDelay: "0.8s" }}>
          내피·외피·발열제·필름부터 세트 구성까지 낱개부터 대량으로 공급합니다.
          <br className="hidden md:block" />
          식단관리 프로그램·식권발행기로 운영까지 밀포인트가 함께합니다.
        </p>
        <div className="hero-rise flex flex-col sm:flex-row gap-4 justify-center" style={{ animationDelay: "1.05s" }}>
          <a
            href="#products"
            className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors"
          >
            제품 보기
          </a>
          <a
            href="#contact"
            className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-white/40 text-text-primary font-semibold backdrop-blur-sm hover:bg-white/10 transition-colors"
          >
            문의하기
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-primary/70">
        <span className="text-xs tracking-widest uppercase">scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-text-primary/70 to-transparent hero-scroll" />
      </div>
    </section>
  );
}
