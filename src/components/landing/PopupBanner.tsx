"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Popup } from "@/lib/supabase/types";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function PopupBanner() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function fetchPopups() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createClient() as any;
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await db
        .from("popups")
        .select("*")
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order("sort_order", { ascending: true });
      setPopups(data || []);
      setLoaded(true);
    }
    // 오늘 이미 닫은 팝업은 표시하지 않음
    const dismissed = sessionStorage.getItem("popup_dismissed");
    if (dismissed === "true") {
      setVisible(false);
      setLoaded(true);
      return;
    }
    fetchPopups();
  }, []);

  // 자동 순환 (5초 간격)
  useEffect(() => {
    if (popups.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % popups.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [popups.length]);

  const handleClose = useCallback(() => {
    setVisible(false);
    sessionStorage.setItem("popup_dismissed", "true");
  }, []);

  const prev = useCallback(() => {
    setCurrent((c) => (c === 0 ? popups.length - 1 : c - 1));
  }, [popups.length]);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % popups.length);
  }, [popups.length]);

  if (!loaded || !visible || popups.length === 0) return null;

  const popup = popups[current];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">새로운 소식</span>
            {popups.length > 1 && (
              <span className="text-xs text-text-muted">
                {current + 1} / {popups.length}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            title="닫기"
            className="p-1 rounded-lg hover:bg-bg-dark text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 이미지 */}
        {popup.image_url && (
          <div className="aspect-video">
            {popup.link_url ? (
              <a href={popup.link_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={popup.image_url}
                  alt={popup.title}
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                />
              </a>
            ) : (
              <img
                src={popup.image_url}
                alt={popup.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        )}

        {/* 콘텐츠 */}
        <div className="p-5">
          <h3 className="text-lg font-bold text-text-primary mb-2">{popup.title}</h3>
          {popup.content && (
            <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
              {popup.content}
            </p>
          )}
          {popup.link_url && (
            <a
              href={popup.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-primary hover:underline"
            >
              자세히 보기 &rarr;
            </a>
          )}
        </div>

        {/* 네비게이션 화살표 */}
        {popups.length > 1 && (
          <>
            <button
              onClick={prev}
              title="이전"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              title="다음"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* 인디케이터 점 */}
        {popups.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-4">
            {popups.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                title={`팝업 ${idx + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === current ? "bg-primary" : "bg-border hover:bg-text-muted"
                }`}
              />
            ))}
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="px-5 pb-4">
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl border border-border text-sm text-text-muted hover:text-text-primary hover:bg-bg-dark transition-colors"
          >
            오늘 하루 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
