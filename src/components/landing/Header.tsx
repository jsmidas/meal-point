"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";

const navLinks = [
  { href: "#why", label: "왜 밀포인트" },
  { href: "#products", label: "제품" },
  { href: "#process", label: "주문방법" },
  { href: "#contact", label: "문의하기" },
];

export default function Header() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [auth, setAuth] = useState<{ authenticated: boolean; role?: string; name?: string }>({
    authenticated: false,
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => setAuth(data))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setAuth({ authenticated: false });
    router.push("/");
  }

  const displayName = auth.role === "admin" ? "관리자" : auth.name || "회원";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-bg-dark/90 backdrop-blur-md shadow-lg"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
            <path
              d="M8 22V12a2 2 0 012-2h12a2 2 0 012 2v10"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M6 22h20"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="16" cy="16" r="3" stroke="#fff" strokeWidth="1.5" />
            <defs>
              <linearGradient
                id="logoGrad"
                x1="0"
                y1="0"
                x2="32"
                y2="32"
              >
                <stop stopColor="#E8A04A" />
                <stop offset="1" stopColor="#7C6AEF" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-lg font-bold text-text-primary">밀포인트</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-text-secondary hover:text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
          {auth.authenticated ? (
            <div className="flex items-center gap-3">
              {auth.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-sm text-primary hover:underline"
                >
                  관리자
                </Link>
              )}
              <span className="text-sm text-text-primary font-medium">
                {displayName}님
              </span>
              <button
                onClick={handleLogout}
                className="text-text-muted hover:text-red-400 transition-colors"
                aria-label="로그아웃"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm px-4 py-2 rounded-full border border-border text-text-secondary hover:text-primary hover:border-primary transition-colors"
            >
              로그인
            </Link>
          )}
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-text-primary"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="md:hidden bg-bg-dark/95 backdrop-blur-md border-t border-border px-6 py-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-3 text-text-secondary hover:text-primary transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {auth.authenticated ? (
            <>
              {auth.role === "admin" && (
                <Link
                  href="/admin"
                  className="block py-3 text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  관리자 페이지
                </Link>
              )}
              <div className="flex items-center justify-between py-3">
                <span className="text-text-primary font-medium">
                  {displayName}님
                </span>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="text-sm text-red-400"
                >
                  로그아웃
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="block py-3 text-text-secondary hover:text-primary transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              로그인
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
