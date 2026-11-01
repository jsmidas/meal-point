export default function PromoVideo() {
  return (
    <section id="video" className="py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            Heating Lunchbox
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary leading-tight">
            물만 부으면 <span className="text-gradient">따끈한 발열도시락</span>
          </h2>
        </div>

        <div className="relative aspect-video rounded-2xl overflow-hidden border border-border-light bg-black shadow-2xl shadow-primary/10">
          {/* 소리 없는 15초 영상: 음소거 자동재생 + 반복 */}
          <video
            className="w-full h-full object-cover"
            src="/videos/promo.mp4"
            poster="/videos/promo-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="밀포인트 발열도시락 사용 방법 홍보 영상"
          />
        </div>
      </div>
    </section>
  );
}
