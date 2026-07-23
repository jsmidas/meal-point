import type { Metadata } from "next";
import Link from "next/link";
import Catalog from "./Catalog";

export const metadata: Metadata = {
  title: "전체 제품 | 밀포인트",
  description:
    "발열도시락·급식용기부터 도시락 용기, 식권발행기까지 — 밀포인트 전체 제품을 검색하고 확인하세요.",
};

export default function ProductsCatalogPage() {
  return (
    <div className="min-h-screen bg-bg-dark">
      {/* 미니 헤더 */}
      <header className="border-b border-border sticky top-0 z-20 bg-bg-dark/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-text-primary">
            밀포인트
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              ← 홈으로
            </Link>
            <Link
              href="/#contact"
              className="px-4 py-2 rounded-lg bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
            >
              주문·견적 문의
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            ALL PRODUCTS
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            전체 <span className="text-gradient">제품</span>
          </h1>
          <p className="text-text-secondary max-w-xl mx-auto">
            발열도시락·급식용기부터 도시락 용기, 식권발행기까지 한눈에.
            찾으시는 제품이 없으면 문의해 주세요 — 대부분 공급 가능합니다.
          </p>
        </div>

        <Catalog />
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-text-muted">
        © {new Date().getFullYear()} 밀포인트 급식포털
      </footer>
    </div>
  );
}
