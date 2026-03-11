"use client";

import { useState } from "react";
import { Plus, X, MessageCircle, Smartphone, Phone } from "lucide-react";

const options = [
  {
    icon: MessageCircle,
    label: "카카오톡",
    href: "https://pf.kakao.com/CHANNEL_ID/chat",
    bg: "bg-[#FEE500]",
    iconColor: "text-[#3C1E1E]",
  },
  {
    icon: Smartphone,
    label: "문자",
    href: "sms:010-5678-1898",
    bg: "bg-accent",
    iconColor: "text-white",
  },
  {
    icon: Phone,
    label: "전화",
    href: "tel:010-5678-1898",
    bg: "bg-primary",
    iconColor: "text-white",
  },
];

export default function FloatingCTA() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Options */}
      {open && (
        <div className="flex flex-col gap-3 mb-2">
          {options.map((opt) => (
            <a
              key={opt.label}
              href={opt.href}
              target={opt.href.startsWith("http") ? "_blank" : undefined}
              rel={opt.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className={`w-12 h-12 rounded-full ${opt.bg} flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}
              aria-label={opt.label}
            >
              <opt.icon size={22} className={opt.iconColor} />
            </a>
          ))}
        </div>
      )}

      {/* Main button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full bg-primary text-bg-dark flex items-center justify-center shadow-lg hover:bg-primary-dark transition-colors"
        aria-label="문의하기"
      >
        {open ? <X size={24} /> : <Plus size={24} />}
      </button>
    </div>
  );
}
