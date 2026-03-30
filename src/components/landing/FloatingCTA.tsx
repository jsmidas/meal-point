"use client";

import { MessageCircle, Smartphone, Phone } from "lucide-react";

const options = [
  {
    icon: MessageCircle,
    label: "카카오톡 상담",
    href: "https://pf.kakao.com/_QxbQxdX/chat",
    bg: "bg-[#FEE500]",
    iconColor: "text-[#3C1E1E]",
  },
  {
    icon: Smartphone,
    label: "문자 문의",
    href: "sms:010-5678-1898",
    bg: "bg-accent",
    iconColor: "text-white",
  },
  {
    icon: Phone,
    label: "전화 문의",
    href: "tel:010-5678-1898",
    bg: "bg-primary",
    iconColor: "text-white",
  },
];

export default function FloatingCTA() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {options.map((opt) => (
        <a
          key={opt.label}
          href={opt.href}
          target={opt.href.startsWith("http") ? "_blank" : undefined}
          rel={opt.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className={`group flex items-center gap-2`}
          aria-label={opt.label}
        >
          <span className="hidden group-hover:block bg-bg-dark/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            {opt.label}
          </span>
          <div
            className={`w-12 h-12 rounded-full ${opt.bg} flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}
          >
            <opt.icon size={22} className={opt.iconColor} />
          </div>
        </a>
      ))}
    </div>
  );
}
