"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Category = "all" | "inner" | "outer" | "heater" | "film" | "set";

interface ProductItem {
  id: string;
  name: string;
  image: string;
  category: Category;
  badge: string;
  href?: string;
}

const categories: { key: Category; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "inner", label: "내피" },
  { key: "outer", label: "외피" },
  { key: "heater", label: "발열제" },
  { key: "set", label: "세트" },
];

const badgeMap: Record<string, string> = {
  inner: "내피",
  outer: "외피",
  heater: "발열제",
  film: "필름",
  set: "세트",
};

const badgeColors: Record<string, string> = {
  내피: "bg-primary/20 text-primary",
  외피: "bg-accent/20 text-accent",
  발열제: "bg-red-500/20 text-red-400",
  필름: "bg-emerald-500/20 text-emerald-400",
  세트: "bg-emerald-500/20 text-emerald-400",
};

export default function Products() {
  const [active, setActive] = useState<Category>("all");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createClient() as any;

      // 활성 상품 + 발행된 상세페이지 조회
      const [{ data: prods }, { data: pages }] = await Promise.all([
        db.from("products").select("id, name, category, image_url").eq("is_active", true).order("name"),
        db.from("product_pages").select("product_id, hero_images").eq("is_published", true),
      ]);

      // 발행된 상세페이지 매핑
      const publishedMap = new Map<string, string[]>();
      for (const pg of pages || []) {
        publishedMap.set(pg.product_id, pg.hero_images || []);
      }

      const items: ProductItem[] = (prods || []).map((p: { id: string; name: string; category: string; image_url: string | null }) => {
        const badge = badgeMap[p.category] || p.category;
        const published = publishedMap.has(p.id);
        // 이미지 우선순위: 상세페이지 히어로 → 상품 이미지
        const heroImages = publishedMap.get(p.id);
        const image = (heroImages && heroImages.length > 0 ? heroImages[0] : null) || p.image_url || "/images/placeholder.jpg";

        return {
          id: p.id,
          name: p.name,
          image,
          category: p.category as Category,
          badge,
          href: published ? `/products/${p.id}` : undefined,
        };
      });

      setProducts(items);
      setLoading(false);
    }
    load();
  }, []);

  const filtered =
    active === "all" ? products : products.filter((p) => p.category === active);

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

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActive(cat.key)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                active === cat.key
                  ? "bg-primary text-bg-dark"
                  : "bg-bg-card text-text-secondary hover:bg-bg-card-hover"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12 text-text-muted">로딩 중...</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => {
              const Card = (
                <div className="group rounded-2xl border border-border bg-bg-card overflow-hidden hover:border-border-light hover:bg-bg-card-hover transition-all">
                  <div className="relative aspect-[4/3] overflow-hidden bg-bg-dark">
                    {product.image.startsWith("http") ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-3 ${
                        badgeColors[product.badge] || "bg-bg-card text-text-muted"
                      }`}
                    >
                      {product.badge}
                    </span>
                    <h4 className="text-lg font-semibold text-text-primary mb-1">
                      {product.name}
                    </h4>
                    <p className="text-sm text-text-muted mb-3">가격문의</p>
                    <span className="inline-flex items-center text-sm font-medium text-primary">
                      {product.href ? "상세보기" : "문의하기"}
                    </span>
                  </div>
                </div>
              );

              if (product.href) {
                return (
                  <Link key={product.id} href={product.href}>
                    {Card}
                  </Link>
                );
              }
              return (
                <a key={product.id} href="#contact">
                  {Card}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
