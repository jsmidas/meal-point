"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Ticket, Printer, Zap, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TicketProduct {
  id: string;
  name: string;
  image: string;
  href?: string;
}

const highlights = [
  { icon: Printer, title: "3인치 전용 프린터", desc: "현장 발권에 최적화된\n전용 감열 프린터 기반" },
  { icon: Zap, title: "빠르고 간편한 발권", desc: "누구나 몇 번의 터치로\n즉시 식권 발행" },
  { icon: ShieldCheck, title: "정확한 식수 관리", desc: "발행 내역이 그대로 기록되어\n식수 정산까지 한 번에" },
];

export default function Ticketing() {
  const [products, setProducts] = useState<TicketProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createClient() as any;

      const [{ data: prods }, { data: pages }] = await Promise.all([
        db.from("products").select("id, name, image_url").eq("is_active", true).eq("category", "ticket_printer").order("name"),
        db.from("product_pages").select("product_id, hero_images").eq("is_published", true),
      ]);

      const publishedMap = new Map<string, string[]>();
      for (const pg of pages || []) {
        publishedMap.set(pg.product_id, pg.hero_images || []);
      }

      const items: TicketProduct[] = (prods || []).map((p: { id: string; name: string; image_url: string | null }) => {
        const published = publishedMap.has(p.id);
        const heroImages = publishedMap.get(p.id);
        const image = (heroImages && heroImages.length > 0 ? heroImages[0] : null) || p.image_url || "/images/placeholder.jpg";
        return {
          id: p.id,
          name: p.name,
          image,
          href: published ? `/products/${p.id}` : undefined,
        };
      });

      setProducts(items);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <section id="ticketing" className="py-24 bg-bg-dark/40">
      <div className="max-w-6xl mx-auto px-6">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            TICKETING
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            <span className="text-gradient">식권발행기</span>
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            3인치 전용 프린터로 누구나 간편하게. 현장에서 빠르고 정확하게 식권을 발행하세요.
          </p>
        </div>

        {/* 대표 이미지: 실제 발권 프로그램이 올라간 구성 */}
        <div className="mb-16 rounded-2xl border border-border bg-bg-card overflow-hidden lg:flex lg:items-center">
          <Link href="/ticketing" className="block lg:w-3/5 group">
            <Image
              src="/images/ticket/machine.png"
              alt="식권발행기 구성 — 터치 모니터와 3인치 전용 프린터"
              width={1262}
              height={918}
              sizes="(max-width: 1024px) 100vw, 640px"
              className="w-full h-auto group-hover:scale-[1.01] transition-transform duration-500"
            />
          </Link>
          <div className="p-8 lg:p-10 lg:w-2/5">
            <h3 className="text-xl font-bold text-text-primary mb-3">
              현장은 터치 모니터 + 전용 프린터, 관리는 웹에서
            </h3>
            <p className="text-text-secondary leading-relaxed mb-6">
              화면 속이 실제 발권 프로그램입니다. 사원번호 입력, 끼니 선택,
              발권까지 터치 몇 번 — 발행 내역은 <strong className="text-text-primary">웹 관리자 화면</strong>으로
              실시간 집계되어 여러 사업장 현황과 정산 리포트까지 한 곳에서
              관리됩니다.
            </p>
            <Link
              href="/ticketing"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
            >
              화면으로 미리보기 →
            </Link>
          </div>
        </div>

        {/* 특장점 */}
        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          {highlights.map((h) => (
            <div key={h.title} className="rounded-2xl border border-border bg-bg-card p-7 text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <h.icon className="text-primary" size={28} />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">{h.title}</h3>
              <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{h.desc}</p>
            </div>
          ))}
        </div>

        {/* 제품 진열 */}
        {loading ? (
          <div className="text-center py-12 text-text-muted">로딩 중...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <Ticket size={40} className="mx-auto text-text-muted mb-4" />
            <p className="text-text-secondary mb-6">식권발행기 도입을 원하시면 문의해 주세요.</p>
            <a
              href="#contact"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors"
            >
              도입 문의하기
            </a>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const Card = (
                <div className="group rounded-2xl border border-border bg-bg-card overflow-hidden hover:border-border-light hover:bg-bg-card-hover transition-all h-full">
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
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3 bg-accent/20 text-accent">
                      식권발행기
                    </span>
                    <h4 className="text-lg font-semibold text-text-primary mb-1">{product.name}</h4>
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
