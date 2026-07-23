"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { productGroups, categoryLabels, type GroupKey } from "@/lib/categories";
import ProductCard, { type ProductCardItem } from "@/components/ProductCard";

interface ProductItem extends ProductCardItem {
  category: string;
}

// 랜딩 쇼케이스에는 용기 관련 그룹만 노출 (식권발행기는 솔루션 섹션에서 소개)
const showcaseGroups = productGroups.filter((g) => g.key !== "ticketing");

const PAGE_SIZE = 12;

export default function Products() {
  const [activeGroup, setActiveGroup] = useState<GroupKey>("heating");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createClient() as any;

      // 활성 상품 + 발행된 상세페이지 조회
      const [{ data: prods }, { data: pages }] = await Promise.all([
        db.from("products").select("id, name, category, image_url").eq("is_active", true).neq("category", "ticket_printer").order("name"),
        db.from("product_pages").select("product_id, hero_images").eq("is_published", true),
      ]);

      // 발행된 상세페이지 매핑
      const publishedMap = new Map<string, string[]>();
      for (const pg of pages || []) {
        publishedMap.set(pg.product_id, pg.hero_images || []);
      }

      const items: ProductItem[] = (prods || []).map((p: { id: string; name: string; category: string; image_url: string | null }) => {
        const published = publishedMap.has(p.id);
        // 이미지 우선순위: 상세페이지 히어로 → 상품 이미지
        const heroImages = publishedMap.get(p.id);
        const image = (heroImages && heroImages.length > 0 ? heroImages[0] : null) || p.image_url || "/images/placeholder.jpg";

        return {
          id: p.id,
          name: p.name,
          image,
          category: p.category,
          badge: categoryLabels[p.category] || p.category,
          href: published ? `/products/${p.id}` : undefined,
        };
      });

      setProducts(items);
      setLoading(false);
    }
    load();
  }, []);

  const group = showcaseGroups.find((g) => g.key === activeGroup)!;
  const inGroup = products.filter((p) => group.categories.includes(p.category));
  const filtered =
    activeCat === "all" ? inGroup : inGroup.filter((p) => p.category === activeCat);
  const visible = filtered.slice(0, visibleCount);

  function selectGroup(key: GroupKey) {
    setActiveGroup(key);
    setActiveCat("all");
    setVisibleCount(PAGE_SIZE);
  }

  function selectCat(cat: string) {
    setActiveCat(cat);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <section id="products" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            PRODUCTS
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            제품 <span className="text-gradient">쇼케이스</span>
          </h2>
          <p className="text-text-secondary">
            다양한 급식 용기 제품을 확인하세요.
          </p>
        </div>

        {/* 대분류 그룹 탭 */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {showcaseGroups.map((g) => (
            <button
              key={g.key}
              onClick={() => selectGroup(g.key)}
              className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all border ${
                activeGroup === g.key
                  ? "bg-primary text-bg-dark border-primary"
                  : "bg-bg-card text-text-secondary border-border hover:bg-bg-card-hover hover:border-border-light"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* 그룹 내 세부 필터 */}
        {group.categories.length > 1 ? (
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            <button
              onClick={() => selectCat("all")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                activeCat === "all"
                  ? "bg-primary text-bg-dark"
                  : "bg-bg-card text-text-secondary hover:bg-bg-card-hover"
              }`}
            >
              전체
            </button>
            {group.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => selectCat(cat)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCat === cat
                    ? "bg-primary text-bg-dark"
                    : "bg-bg-card text-text-secondary hover:bg-bg-card-hover"
                }`}
              >
                {categoryLabels[cat] || cat}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-4" />
        )}

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12 text-text-muted">로딩 중...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-secondary mb-6">
              제품 목록을 불러오지 못했습니다. 잠시 후 다시 시도하시거나 문의해 주세요.
            </p>
            <a
              href="#contact"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
            >
              문의하기
            </a>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            해당 분류의 제품을 준비 중입니다. 곧 만나보실 수 있어요.
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* 더보기 · 전체 제품 */}
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {filtered.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="inline-flex items-center px-8 py-3 rounded-full border border-border text-text-primary font-semibold text-sm hover:bg-bg-card-hover hover:border-border-light transition-all"
                >
                  제품 더보기 ({visibleCount}/{filtered.length})
                </button>
              )}
              <Link
                href="/products"
                className="inline-flex items-center px-8 py-3 rounded-full bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
              >
                전체 제품 검색·보기 →
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
