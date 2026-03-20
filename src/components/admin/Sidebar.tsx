"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Package,
  ShoppingCart,
  FileText,
  ClipboardList,
  Receipt,
  TrendingUp,
  Warehouse,
  Home,
  Menu,
  X,
  LogOut,
  Bell,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeDollarSign,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/companies", label: "거래처 관리", icon: Building2 },
  { href: "/admin/products", label: "상품 관리", icon: Package },
  { href: "/admin/prices", label: "단가 관리", icon: BadgeDollarSign },
  { href: "/admin/inbound", label: "입고 관리", icon: ArrowDownCircle },
  { href: "/admin/sales", label: "판매 관리", icon: ArrowUpCircle },
  { href: "/admin/inventory", label: "재고 수불", icon: Warehouse },
  { href: "/admin/orders", label: "주문 관리", icon: ShoppingCart },
  { href: "/admin/quotes", label: "견적서", icon: ClipboardList },
  { href: "/admin/statements", label: "거래명세서", icon: FileText },
  { href: "/admin/billing", label: "정산 관리", icon: Receipt },
  { href: "/admin/pnl", label: "손익 현황", icon: TrendingUp },
  { href: "/admin/popups", label: "팝업 관리", icon: Bell },
  { href: "/admin/settings", label: "회사 설정", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const Nav = () => (
    <>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
            isActive(item.href)
              ? "bg-primary/10 text-primary"
              : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
          }`}
        >
          <item.icon size={20} />
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-bg-dark">
        <Link href="/" className="text-lg font-bold text-text-primary">
          밀포인트
        </Link>
        <button onClick={() => setOpen(!open)} className="text-text-primary">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 top-[53px] z-40 bg-bg-dark/95 backdrop-blur-md p-4">
          <nav className="space-y-1">
            <Nav />
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen border-r border-border bg-bg-dark p-4">
        <div className="flex items-center gap-2 px-4 py-3 mb-6">
          <Link href="/" className="text-lg font-bold text-text-primary">
            밀포인트
          </Link>
          <span className="text-xs text-text-muted bg-bg-card px-2 py-0.5 rounded-full">
            관리자
          </span>
        </div>
        <nav className="space-y-1 flex-1">
          <Nav />
        </nav>
        <div className="border-t border-border pt-4 mt-4 space-y-1">
          <div className="px-4 py-2 text-xs text-text-muted truncate">
            admin
          </div>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <Home size={20} />
            홈페이지로 돌아가기
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={20} />
            로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}
