"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Product, ProductPage, KeyPoint, SpecItem, ProcessStep, FigmaEmbed } from "@/lib/supabase/types";
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
  shield: Shield,
  flame: Flame,
  thermometer: Thermometer,
  leaf: Leaf,
  star: Star,
  zap: Zap,
  droplet: Droplet,
  box: Box,
  "check-circle": CheckCircle,
  award: Award,
  heart: Heart,
  sun: Sun,
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const supabase = createClient();

  const [product, setProduct] = useState<Product | null>(null);
  const [page, setPage] = useState<ProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [galleryIdx, setGalleryIdx] = useState(0);

  useEffect(() => {
    async function fetchData() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: prod } = await db
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      const { data: pg } = await db
        .from("product_pages")
        .select("*")
        .eq("product_id", id)
        .eq("is_published", true)
        .maybeSingle();

      setProduct(prod || null);
      setPage(pg || null);
      setLoading(false);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="text-text-muted">로딩 중...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">상품을 찾을 수 없습니다.</p>
          <Link href="/" className="text-primary hover:underline">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">
            상세페이지가 준비 중입니다.
          </p>
          <Link href="/" className="text-primary hover:underline">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const keyPoints = (page.key_points || []) as KeyPoint[];
  const specs = (page.specs || []) as SpecItem[];
  const processSteps = (page.process_steps || []) as ProcessStep[];
  const galleryImages = (page.gallery_images || []) as string[];
  const detailImages = (page.detail_images || []) as string[];
  const figmaEmbeds = (page.figma_urls || []) as FigmaEmbed[];

  return (
    <div className="min-h-screen bg-bg-dark">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-dark/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">돌아가기</span>
          </Link>
          <Link href="/" className="text-lg font-bold text-text-primary">
            밀포인트
          </Link>
          <div className="w-20" />
        </div>
      </nav>

      {/* === Hero Section === */}
      <section className="relative pt-16">
        {page.hero_image ? (
          <div className="relative h-[60vh] min-h-[400px]">
            <img
              src={page.hero_image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
              <div className="max-w-6xl mx-auto">
                <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
                  {product.category}
                </p>
                <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
                  {product.name}
                </h1>
                {page.subtitle && (
                  <p className="text-lg text-gray-300 max-w-xl">
                    {page.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-24 pb-16 px-6">
            <div className="max-w-6xl mx-auto">
              <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
                {product.category}
              </p>
              <h1 className="text-4xl md:text-6xl font-black text-text-primary mb-4">
                {product.name}
              </h1>
              {page.subtitle && (
                <p className="text-lg text-text-secondary max-w-xl">
                  {page.subtitle}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* === Price Section === */}
      {product.selling_price > 0 && (
        <section className="py-10 px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <div className="inline-flex flex-wrap items-end gap-6 px-8 py-6 rounded-2xl border border-border bg-bg-card">
              <div>
                <p className="text-xs text-text-muted mb-1">EA 단가 <span className="text-amber-400">(부가세 별도)</span></p>
                <p className="text-3xl font-black text-text-primary">
                  {product.selling_price.toLocaleString()}<span className="text-lg font-medium text-text-secondary ml-1">원</span>
                </p>
              </div>
              {(product.box_quantity ?? 1) > 1 && (
                <div className="border-l border-border pl-6">
                  <p className="text-xs text-text-muted mb-1">박스 단가 <span className="text-text-muted">({product.box_quantity}EA/박스)</span></p>
                  <p className="text-2xl font-bold text-primary">
                    {(product.selling_price * product.box_quantity).toLocaleString()}<span className="text-sm font-medium text-text-secondary ml-1">원</span>
                  </p>
                </div>
              )}
              <p className="text-[11px] text-text-muted">※ 거래처별 단가는 별도 협의</p>
            </div>
          </div>
        </section>
      )}

      {/* === Feature Section === */}
      {(page.feature_title || page.feature_description) && (
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              {page.feature_title && (
                <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-6 leading-tight">
                  {page.feature_title}
                </h2>
              )}
              {page.feature_description && (
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">
                  {page.feature_description}
                </p>
              )}
            </div>
            {page.feature_image && (
              <div className="rounded-2xl overflow-hidden">
                <img
                  src={page.feature_image}
                  alt="Feature"
                  className="w-full h-auto"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* === Key Points Section === */}
      {keyPoints.length > 0 && (
        <section className="py-20 px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-text-primary text-center mb-12">
              핵심 포인트
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {keyPoints.map((kp, idx) => {
                const IconComp = iconMap[kp.icon] || Star;
                return (
                  <div
                    key={idx}
                    className="text-center p-6 rounded-2xl border border-border bg-bg-card hover:border-primary/30 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <IconComp size={24} className="text-primary" />
                    </div>
                    <h3 className="font-semibold text-text-primary mb-2">
                      {kp.title}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {kp.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* === Specs Table === */}
      {specs.length > 0 && (
        <section className="py-20 px-6 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-text-primary text-center mb-2">
              PRODUCT INFO
            </h2>
            <p className="text-text-muted text-center mb-10">제품 사양</p>
            <div className="rounded-2xl border border-border overflow-hidden">
              {specs.map((spec, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    idx < specs.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="w-1/3 px-6 py-4 bg-bg-card text-sm font-medium text-text-secondary">
                    {spec.label}
                  </div>
                  <div className="w-2/3 px-6 py-4 text-sm text-text-primary">
                    {spec.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* === Detail Description === */}
      {(page.detail_description || detailImages.length > 0) && (
        <section className="py-20 px-6 border-t border-border">
          <div className="max-w-4xl mx-auto">
            {page.detail_description && (
              <div className="prose prose-invert max-w-none mb-12">
                <p className="text-text-secondary leading-relaxed whitespace-pre-line text-base">
                  {page.detail_description}
                </p>
              </div>
            )}
            {detailImages.length > 0 && (
              <div className="space-y-6">
                {detailImages.map((url, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl overflow-hidden border border-border"
                  >
                    <img
                      src={url}
                      alt={`Detail ${idx + 1}`}
                      className="w-full h-auto"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* === Process Steps === */}
      {processSteps.length > 0 && (
        <section className="py-20 px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            {page.process_title && (
              <h2 className="text-2xl font-bold text-text-primary text-center mb-12">
                {page.process_title}
              </h2>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {processSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-bg-card p-6 hover:border-primary/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm mb-4">
                    {step.step}
                  </div>
                  <h3 className="font-semibold text-text-primary mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {step.description}
                  </p>
                  {step.image && (
                    <div className="mt-4 rounded-xl overflow-hidden">
                      <img
                        src={step.image}
                        alt={step.title}
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* === Gallery === */}
      {galleryImages.length > 0 && (
        <section className="py-20 px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-text-primary text-center mb-12">
              갤러리
            </h2>
            {/* Main image */}
            <div className="relative rounded-2xl overflow-hidden mb-4 aspect-video">
              <img
                src={galleryImages[galleryIdx]}
                alt={`Gallery ${galleryIdx + 1}`}
                className="w-full h-full object-cover"
              />
              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setGalleryIdx((prev) =>
                        prev === 0 ? galleryImages.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() =>
                      setGalleryIdx((prev) =>
                        prev === galleryImages.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
            {/* Thumbnails */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {galleryImages.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setGalleryIdx(idx)}
                    className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                      idx === galleryIdx
                        ? "border-primary"
                        : "border-border hover:border-text-muted"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Thumb ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* === Figma Embeds === */}
      {figmaEmbeds.length > 0 && (
        <section className="py-20 px-6 border-t border-border">
          <div className="max-w-6xl mx-auto space-y-12">
            {figmaEmbeds.map((figma, idx) => {
              const embedUrl = /figma\.com\/(file|design|proto)\//.test(figma.url)
                ? `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(figma.url)}`
                : null;
              if (!embedUrl) return null;
              return (
                <div key={idx}>
                  {figma.title && (
                    <h2 className="text-2xl font-bold text-text-primary text-center mb-8">
                      {figma.title}
                    </h2>
                  )}
                  <div className="rounded-2xl overflow-hidden border border-border aspect-[16/10]">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      title={figma.title || `Design ${idx + 1}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* === CTA / Footer === */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-4">
            {product.name}에 관심이 있으신가요?
          </h2>
          <p className="text-text-secondary mb-8">
            견적 문의나 샘플 요청을 남겨주세요.
          </p>
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
