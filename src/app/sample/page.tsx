"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Flame,
  Thermometer,
  Leaf,
  Star,
  Zap,
  Droplet,
  Box,
  CheckCircle,
  Award,
  Heart,
  Sun,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  shield: Shield, flame: Flame, thermometer: Thermometer, leaf: Leaf,
  star: Star, zap: Zap, droplet: Droplet, box: Box,
  "check-circle": CheckCircle, award: Award, heart: Heart, sun: Sun,
};

// 샘플 상품 데이터 (발열 외피 기준)
const sampleProduct = {
  name: "발열외피 5칸",
  category: "외피",
};

const samplePage = {
  hero_image: "/images/발열외피 바디, 뚜껑.jpg",
  subtitle: "따뜻한 음식을 위한 시작 — 급식의 새로운 기준을 세우는 프리미엄 발열 용기",
  feature_title: "따뜻한 음식을\n위한 시작",
  feature_description:
    "음식의 맛은 온도에 의해 좌우됩니다.\n발열 외피는 식사 시간까지 최적의 온도를 유지하여\n새로운 급식 경험을 제공합니다.\n\n40도 / 60분 이상의\n밀포인트 발열용기에 맡기세요!",
  feature_image: "/images/발열외피+내피.jpg",
  key_points: [
    { icon: "zap", title: "간편한 온도", description: "발열제만 넣으면 즉시 보온이 시작됩니다" },
    { icon: "shield", title: "완벽한 사이즈", description: "발열 후 1시간 이상 내부 온도 40도 이상 유지" },
    { icon: "thermometer", title: "넉넉한 가성비", description: "대량 구매 시 개당 단가를 최소화했습니다" },
    { icon: "box", title: "다양한 변형화", description: "3칸, 4칸, 5칸, 6칸 등 맞춤 규격 제공" },
  ],
  specs: [
    { label: "용도", value: "일회용 발열 용기 외피" },
    { label: "규격", value: "5칸 (밥 + 국 + 반찬 3)" },
    { label: "재질", value: "PP (폴리프로필렌)" },
    { label: "크기(mm)", value: "330 × 258 × 70 (±5%)" },
    { label: "색상", value: "블랙 / 아이보리 / 그레이" },
    { label: "제조사", value: "MEAL POINT" },
    { label: "인증", value: "식품위생법 적합 판정" },
  ],
  detail_description:
    "발열외피는 고온에도 변형 없는 고급 PP 소재로 제작되었습니다.\n내피와 결합하여 사용하며, 발열제를 통해 약 40~60도의 온도를 60분 이상 유지합니다.\n\n군급식, 학교급식, 단체급식에 최적화된 제품으로\n현재 전국의 다양한 급식업체에서 사용 중입니다.\n\n자체 특허 구조로 열 전달 효율을 극대화하였으며,\n외피와 내피의 정밀한 결합으로 밀봉성을 높여\n이동 중에도 안전하게 배달할 수 있습니다.",
  detail_images: [
    "/images/발열외비+발열제.jpg",
    "/images/발열내피_6칸.jpg",
  ],
  process_title: "분리된 포장 공정 — 만족하게 하는 선택!",
  process_steps: [
    { step: 1, title: "내피를 선택", description: "음식에 맞는 내피(3~6칸)를 골라 음식을 담습니다" },
    { step: 2, title: "내피에 음식을 담기", description: "준비된 음식을 각 칸에 배분하여 담습니다" },
    { step: 3, title: "외피에 발열제와 물을 넣기", description: "외피 하단에 발열제를 놓고 적정량의 물을 부어줍니다" },
    { step: 4, title: "조립된 용기를 필름 밀봉", description: "내피를 외피에 결합한 후 필름으로 밀봉합니다" },
    { step: 5, title: "상차를 위한 적재", description: "밀봉된 용기를 운반용 박스에 적재합니다" },
    { step: 6, title: "상차 및 배송 후 수령", description: "배송지까지 안전하게 운반되어 따뜻한 급식을 제공합니다" },
  ],
  gallery_images: [
    "/images/발열외피 바디.jpg",
    "/images/발열외피 바디, 뚜껑.jpg",
    "/images/발열외피+내피.jpg",
    "/images/발열외비+발열제.jpg",
  ],
};

export default function SampleProductPage() {
  const [galleryIdx, setGalleryIdx] = useState(0);

  const product = sampleProduct;
  const page = samplePage;

  return (
    <div className="min-h-screen bg-bg-dark">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-dark/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm">돌아가기</span>
          </Link>
          <Link href="/" className="text-lg font-bold text-text-primary">밀포인트</Link>
          <div className="w-20" />
        </div>
      </nav>

      {/* 샘플 배너 */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-primary/90 text-bg-dark text-center py-2 text-sm font-semibold">
        샘플 미리보기 — 실제 상세페이지는 관리자에서 편집할 수 있습니다
      </div>

      {/* === Hero Section === */}
      <section className="relative pt-24">
        <div className="relative h-[60vh] min-h-[400px]">
          <img src={page.hero_image} alt={product.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
            <div className="max-w-6xl mx-auto">
              <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">{product.category}</p>
              <h1 className="text-4xl md:text-6xl font-black text-white mb-4">{product.name}</h1>
              <p className="text-lg text-gray-300 max-w-xl">{page.subtitle}</p>
            </div>
          </div>
        </div>
      </section>

      {/* === Feature Section === */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-6 leading-tight whitespace-pre-line">
              {page.feature_title}
            </h2>
            <p className="text-text-secondary leading-relaxed whitespace-pre-line">{page.feature_description}</p>
          </div>
          <div className="rounded-2xl overflow-hidden">
            <img src={page.feature_image} alt="Feature" className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* === Key Points Section === */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-4">4가지 키포인트</h2>
          <p className="text-text-muted text-center mb-12">밀포인트 발열용기의 핵심 가치</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {page.key_points.map((kp, idx) => {
              const IconComp = iconMap[kp.icon] || Star;
              return (
                <div key={idx} className="text-center p-6 rounded-2xl border border-border bg-bg-card hover:border-primary/30 transition-all hover:-translate-y-1">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <IconComp size={28} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-text-primary mb-2 text-lg">{kp.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{kp.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* === Specs Table === */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-2">PRODUCT INFO</h2>
          <p className="text-text-muted text-center mb-10">제품 사양</p>
          <div className="rounded-2xl border border-border overflow-hidden">
            {page.specs.map((spec, idx) => (
              <div key={idx} className={`flex ${idx < page.specs.length - 1 ? "border-b border-border" : ""}`}>
                <div className="w-1/3 px-6 py-4 bg-bg-card text-sm font-medium text-text-secondary">{spec.label}</div>
                <div className="w-2/3 px-6 py-4 text-sm text-text-primary">{spec.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === Detail Description === */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-12">상세 설명</h2>
          <div className="prose prose-invert max-w-none mb-12">
            <p className="text-text-secondary leading-relaxed whitespace-pre-line text-base">{page.detail_description}</p>
          </div>
          <div className="space-y-6">
            {page.detail_images.map((url, idx) => (
              <div key={idx} className="rounded-2xl overflow-hidden border border-border">
                <img src={url} alt={`Detail ${idx + 1}`} className="w-full h-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === Process Steps === */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-4">{page.process_title}</h2>
          <p className="text-text-muted text-center mb-12">간편한 6단계 포장 공정</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {page.process_steps.map((step, idx) => (
              <div key={idx} className="rounded-2xl border border-border bg-bg-card p-6 hover:border-primary/30 transition-all hover:-translate-y-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm mb-4">
                  {step.step}
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === Gallery === */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-12">갤러리</h2>
          <div className="relative rounded-2xl overflow-hidden mb-4 aspect-video">
            <img src={page.gallery_images[galleryIdx]} alt={`Gallery ${galleryIdx + 1}`} className="w-full h-full object-cover" />
            {page.gallery_images.length > 1 && (
              <>
                <button
                  onClick={() => setGalleryIdx((prev) => (prev === 0 ? page.gallery_images.length - 1 : prev - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setGalleryIdx((prev) => (prev === page.gallery_images.length - 1 ? 0 : prev + 1))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {page.gallery_images.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setGalleryIdx(idx)}
                className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                  idx === galleryIdx ? "border-primary" : "border-border hover:border-text-muted"
                }`}
              >
                <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* === CTA / Footer === */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-4">{product.name}에 관심이 있으신가요?</h2>
          <p className="text-text-secondary mb-8">견적 문의나 샘플 요청을 남겨주세요.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors"
            >
              문의하기
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-border text-text-primary font-semibold hover:bg-white/5 transition-colors"
            >
              다른 제품 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
