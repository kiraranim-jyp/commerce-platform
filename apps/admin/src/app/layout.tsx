import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** N-3.24(CPO 지시, 2026-08-13) — TTAEJYO(따져) 브랜드 리뉴얼. metadataBase는
 * 새 도메인을 지어내는 게 아니라 기존 실제 배포 URL을 그대로 지정한 것이다
 * (7장 원칙: 도메인 변경은 이번 범위 밖, OG 이미지 절대경로 계산에만 필요). */
export const metadata: Metadata = {
  metadataBase: new URL("https://commerce-platform-mocha.vercel.app"),
  title: "따져(TTAEJYO) — 이거 사서 팔아도 남아?",
  description: "해외 상품 URL 하나로, 원가부터 마진까지 AI가 따져서 국내 마켓 등록 준비를 끝내는 커머스 코파일럿.",
  openGraph: {
    title: "따져(TTAEJYO) — 이거 사서 팔아도 남아?",
    description: "원가부터 마진까지, 꼼꼼하게 따져드립니다.",
    siteName: "따져",
  },
  twitter: {
    card: "summary_large_image",
    title: "따져(TTAEJYO) — 이거 사서 팔아도 남아?",
    description: "원가부터 마진까지, 꼼꼼하게 따져드립니다.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-text-primary">{children}</body>
    </html>
  );
}
