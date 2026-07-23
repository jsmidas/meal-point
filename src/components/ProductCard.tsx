import Image from "next/image";
import Link from "next/link";
import { badgeColors } from "@/lib/categories";

export interface ProductCardItem {
  id: string;
  name: string;
  image: string;
  badge: string;
  href?: string;
}

export default function ProductCard({
  product,
  contactHref = "#contact",
}: {
  product: ProductCardItem;
  contactHref?: string;
}) {
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
    return <Link href={product.href}>{Card}</Link>;
  }
  return <a href={contactHref}>{Card}</a>;
}
