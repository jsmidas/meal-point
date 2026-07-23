"use client";

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { productGroups, categoryLabels, type GroupKey } from "@/lib/categories";
import ProductCard, { type ProductCardItem } from "@/components/ProductCard";

interface CatalogItem extends ProductCardItem {
  category: string;
}

const PAGE_SIZE = 24;

export default function Catalog() {
  const [activeGroup, setActiveGroup] = useState<GroupKey | "all">("all");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createClient() as any;

      const [{ data: prods }, { data: pages }] = await Promise.all([
        db.from("products").select("id, name, category, image_url").eq("is_active", true).order("name"),
        db.from("product_pages").select("product_id, hero_images").eq("is_published", true),
      ]);

      const publishedMap = new Map<string, string[]>();
      for (const pg of pages || []) {
        publishedMap.set(pg.product_id, pg.hero_images || []);
      }

      const items: CatalogItem[] = (prods || []).map((p: { id: string; name: string; category: string; image_url: string | null }) => {
        const published = publishedMap.has(p.id);
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

  const group = productGroups.find((g) => g.key === activeGroup);

  const filtered = useMemo(() => {
    let list = products;
    if (group) list = list.filter((p) => group.categories.includes(p.category));
    if (activeCat !== "all") list = list.filter((p) => p.category === activeCat);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [products, group, activeCat, search]);

  const visible = filtered.slice(0, visibleCount);

  function selectGroup(key: GroupKey | "all") {
    setActiveGroup(key);
    setActiveCat("all");
    setVisibleCount(PAGE_SIZE);
  }

  function selectCat(cat: string) {
    setActiveCat(cat);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div>
      {/* 검색 */}
      <div className="relative max-w-md mx-auto mb-8">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="제품명으로 검색"
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* 대분류 그룹 탭 */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <button
          onClick={() => selectGroup("all")}
          className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all border ${
            activeGroup === "all"
              ? "bg-primary text-bg-dark border-primary"
              : "bg-bg-card text-text-secondary border-border hover:bg-bg-card-hover hover:border-border-light"
          }`}
        >
          전체
        </button>
        {productGroups.map((g) => (
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
      {group && group.categories.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
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
      )}

      {/* 결과 */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">로딩 중...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-secondary mb-6">
            제품 목록을 불러오지 못했습니다. 잠시 후 다시 시도하시거나 문의해 주세요.
          </p>
          <a
            href="/#contact"
            className="inline-flex items-center px-6 py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
          >
            문의하기
          </a>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          {search.trim()
            ? `"${search.trim()}" 검색 결과가 없습니다. 다른 이름으로 검색하시거나 문의해 주세요.`
            : "해당 분류의 제품을 준비 중입니다. 곧 만나보실 수 있어요."}
        </div>
      ) : (
        <>
          <p className="text-sm text-text-muted mb-5">
            총 <span className="text-text-primary font-semibold">{filtered.length}</span>개 제품
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} contactHref="/#contact" />
            ))}
          </div>

          {filtered.length > visibleCount && (
            <div className="mt-10 text-center">
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="inline-flex items-center px-8 py-3 rounded-full border border-border text-text-primary font-semibold text-sm hover:bg-bg-card-hover hover:border-border-light transition-all"
              >
                제품 더보기 ({visibleCount}/{filtered.length})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
