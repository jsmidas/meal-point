import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "밀포인트 | 급식 용기 도매 전문",
  description:
    "급식 용기의 새로운 기준, 밀포인트. 내피, 외피, 발열제, 필름 등 급식 용기 도매 전문.",
  keywords: "급식용기, 도매, 내피, 외피, 발열제, 필름, 밀포인트, mealpoint",
  openGraph: {
    title: "밀포인트 | 급식 용기 도매 전문",
    description: "급식 용기의 새로운 기준. 도매 전문, 빠른 배송, 직접 상담.",
    type: "website",
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
