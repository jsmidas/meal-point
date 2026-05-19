import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mealpoint.co.kr"),
  title: "밀포인트 | 급식포털 — 용기 도소매·식단관리·식권발행",
  description:
    "급식 현장의 모든 것을 한 곳에서. 발열도시락·급식용기 도소매, 식단관리 프로그램, 3인치 전용 프린터 식권발행기까지 — 밀포인트 급식포털.",
  keywords:
    "급식포털, 급식용기, 발열도시락, 도소매, 식단관리프로그램, 식권발행기, 내피, 외피, 발열제, 필름, 밀포인트, mealpoint",
  openGraph: {
    title: "밀포인트 | 급식포털 — 용기 도소매·식단관리·식권발행",
    description:
      "발열도시락·급식용기 도소매부터 식단관리·식권발행까지. 급식 현장의 파트너, 밀포인트 급식포털.",
    url: "https://mealpoint.co.kr",
    siteName: "밀포인트",
    locale: "ko_KR",
    type: "website",
  },
  alternates: {
    canonical: "https://mealpoint.co.kr",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKR.variable} antialiased`}>{children}</body>
    </html>
  );
}
