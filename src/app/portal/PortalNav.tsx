"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LogOut, PlusCircle } from "lucide-react";

const tabs = [
  { href: "/portal/order/new", label: "발주하기", icon: PlusCircle },
  { href: "/portal", label: "발주내역", icon: ClipboardList },
];

export default function PortalNav({
  companyName,
  userName,
}: {
  companyName: string;
  userName: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
  }

  return (
    <header className="border-b border-border bg-bg-card">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/portal" className="text-lg font-bold text-text-primary shrink-0">
              밀포인트
            </Link>
            <span className="text-xs text-text-muted bg-bg-dark px-2 py-0.5 rounded-full truncate">
              {companyName} 발주
            </span>
          </div>
          <div className="flex items-center gap-3">
            {userName && (
              <span className="hidden sm:inline text-sm text-text-secondary truncate max-w-[8rem]">
                {userName}님
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-red-400 transition-colors"
            >
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        </div>
        <nav className="flex gap-1 -mb-px">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive(t.href)
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
