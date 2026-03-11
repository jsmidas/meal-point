"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

type Category = "all" | "inner" | "outer" | "heater" | "set";

interface Product {
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

const badgeColors: Record<string, string> = {
  내피: "bg-primary/20 text-primary",
  외피: "bg-accent/20 text-accent",
  발열제: "bg-red-500/20 text-red-400",
  세트: "bg-emerald-500/20 text-emerald-400",
};

const products: Product[] = [
  {
    name: "일품 6칸 내피",
    image: "/images/001.jpg",
    category: "inner",
    badge: "내피",
    href: "/products/6kan-naepi",
  },
  {
    name: "8칸 내피",
    image: "/images/002.jpg",
    category: "inner",
    badge: "내피",
    href: "/products/8kan-naepi",
  },
  {
    name: "발열 6칸 내피",
    image: "/images/발열내피_6칸.jpg",
    category: "inner",
    badge: "내피",
  },
  {
    name: "일회용 외피 (PP)",
    image: "/images/003.jpg",
    category: "outer",
    badge: "외피",
    href: "/products/ilhoeyo-oepi",
  },
  {
    name: "다회용 발열 외피 (EPP)",
    image: "/images/004.jpg",
    category: "outer",
    badge: "외피",
    href: "/products/dahoeyo-oepi",
  },
  {
    name: "발열 외피 바디 + 뚜껑",
    image: "/images/발열외피 바디, 뚜껑.jpg",
    category: "outer",
    badge: "외피",
  },
  {
    name: "급식용 발열제",
    image: "/images/발열외비+발열제.jpg",
    category: "heater",
    badge: "발열제",
  },
  {
    name: "일회용 외피 + 발열제 세트",
    image: "/images/일회용-외피-발열제.png",
    category: "set",
    badge: "세트",
  },
  {
    name: "발열 외피 + 내피 세트",
    image: "/images/발열외피+내피.jpg",
    category: "set",
    badge: "세트",
  },
];

export default function Products() {
  const [active, setActive] = useState<Category>("all");

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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((product) => {
            const Card = (
              <div className="group rounded-2xl border border-border bg-bg-card overflow-hidden hover:border-border-light hover:bg-bg-card-hover transition-all">
                <div className="relative aspect-[4/3] overflow-hidden bg-bg-dark">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="p-5">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-3 ${
                      badgeColors[product.badge]
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
                <Link key={product.name} href={product.href}>
                  {Card}
                </Link>
              );
            }
            return (
              <a key={product.name} href="#contact">
                {Card}
              </a>
            );
          })}
        </div>

        {/* More link */}
        <div className="text-center mt-12">
          <a
            href="https://mealpoint.cafe24.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border-light text-text-primary hover:bg-white/5 transition-colors"
          >
            전체 제품 보기 <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
