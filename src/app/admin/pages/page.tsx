"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/supabase/types";
import Link from "next/link";
import {
  FileEdit,
  Eye,
  Plus,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
} from "lucide-react";

interface PageInfo {
  id: string;
  product_id: string;
  is_published: boolean;
  hero_image: string | null;
  subtitle: string | null;
  updated_at: string;
}

export default function PagesListPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [{ data: prods }, { data: pgs }] = await Promise.all([
        db.from("products").select("*").order("name"),
        db
          .from("product_pages")
          .select("id, product_id, is_published, hero_image, subtitle, updated_at"),
      ]);
      setProducts(prods || []);
      setPages(pgs || []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPage = (productId: string) =>
    pages.find((p) => p.product_id === productId);

  if (loading) {
    return (
      <div className="text-center py-20 text-text-muted">로딩 중...</div>
    );
  }

  const withPage = products.filter((p) => getPage(p.id));
  const withoutPage = products.filter((p) => !getPage(p.id));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">상세페이지</h1>
          <p className="text-sm text-text-secondary mt-1">
            상품별 상세페이지를 관리하세요 — {pages.length}개 생성됨 / 전체{" "}
            {products.length}개 상품
          </p>
        </div>
      </div>

      {/* 생성된 페이지 */}
      {withPage.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">
            상세페이지 관리
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {withPage.map((product) => {
              const pg = getPage(product.id)!;
              return (
                <div
                  key={product.id}
                  className="rounded-2xl border border-border bg-bg-card overflow-hidden hover:border-primary/50 transition-colors"
                >
                  {/* 히어로 이미지 미리보기 */}
                  <div className="h-36 bg-bg-dark relative">
                    {pg.hero_image ? (
                      <img
                        src={pg.hero_image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <ImageIcon size={32} />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          pg.is_published
                            ? "bg-emerald-400/20 text-emerald-400"
                            : "bg-red-400/20 text-red-400"
                        }`}
                      >
                        {pg.is_published ? "공개" : "비공개"}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-text-primary truncate">
                      {product.name}
                    </h3>
                    {pg.subtitle && (
                      <p className="text-xs text-text-muted mt-1 truncate">
                        {pg.subtitle}
                      </p>
                    )}
                    <p className="text-xs text-text-muted mt-2">
                      수정:{" "}
                      {new Date(pg.updated_at).toLocaleDateString("ko-KR")}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Link
                        href={`/admin/pages/${product.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                      >
                        <FileEdit size={14} /> 편집
                      </Link>
                      <Link
                        href={`/products/${product.id}`}
                        target="_blank"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors"
                      >
                        <Eye size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 미생성 상품 */}
      {withoutPage.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">
            상세페이지 미생성
          </h2>
          <div className="rounded-2xl border border-border bg-bg-card divide-y divide-border">
            {withoutPage.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <XCircle
                    size={16}
                    className="text-text-muted shrink-0"
                  />
                  <span className="text-sm text-text-primary">
                    {product.name}
                  </span>
                  <span className="text-xs text-text-muted">
                    {product.category}
                  </span>
                </div>
                <Link
                  href={`/admin/pages/${product.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus size={14} /> 생성
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
