"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { MessageCircle, Phone, Smartphone, X } from "lucide-react";

import { KAKAO_CHAT_URL } from "./kakaoChannel";

const PHONE = "010-5678-1898";

function isMobileDevice() {
  const ua = navigator.userAgent;
  // iPadOS는 데스크톱 UA를 쓰므로 터치 지원 여부로 구분
  const isIPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod/i.test(ua) || isIPadOS;
}

type Props = {
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
};

/**
 * 카카오톡 채널 상담 링크.
 * - 모바일: 카카오톡 앱 채팅방으로 바로 이동
 * - PC: 브라우저에서는 채팅창이 열리지 않으므로 안내창을 먼저 띄움
 */
export default function KakaoChatLink({ className, children, ...rest }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isMobileDevice()) return;
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <a
        href={KAKAO_CHAT_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={className}
        aria-label={rest["aria-label"]}
      >
        {children}
      </a>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kakao-chat-title"
            className="relative bg-bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3
                id="kakao-chat-title"
                className="text-sm font-medium text-text-primary"
              >
                카카오톡 상담
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <a
                  href={KAKAO_CHAT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#FEE500] text-[#3C1E1E] font-semibold py-3 hover:brightness-95 transition"
                >
                  <MessageCircle size={18} />
                  PC에서 상담 시작
                </a>
                <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                  카카오계정 로그인 후, 대화는 브라우저가 아니라{" "}
                  <span className="text-text-primary whitespace-nowrap">
                    카카오톡 앱의 &lsquo;밀포인트&rsquo; 채팅방
                  </span>
                  에서 이어집니다. 휴대폰 또는 PC 카카오톡을 확인해 주세요.
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-text-muted mb-3">
                  카카오톡을 쓰지 않으시면
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={`tel:${PHONE}`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm text-text-primary hover:bg-bg-card-hover transition-colors"
                  >
                    <Phone size={16} className="text-primary" />
                    전화
                  </a>
                  <a
                    href={`sms:${PHONE}`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm text-text-primary hover:bg-bg-card-hover transition-colors"
                  >
                    <Smartphone size={16} className="text-primary" />
                    문자
                  </a>
                </div>
                <p className="mt-3 text-center text-sm font-medium text-text-primary">
                  {PHONE}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
