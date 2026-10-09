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
    /* ══ 🔴 P5.6(CEO 실측, 2026-10-09) — **모든 탭에서 2중 스크롤** ══════════════

       AppShell 은 「세로 스크롤은 하나」를 이미 지키고 있다 —
         div.h-dvh.overflow-hidden  (바깥은 안 움직인다)
         main.min-h-0.flex-1.overflow-y-auto  (여기서만 스크롤)
       p0kc07 ④ 가 그 두 줄을 가드로 박아 뒀고 지금도 통과한다.

       🔴 그런데 그 «바깥» 이 문제였다. `html.h-full` + `body.min-h-full` 인데
          어느 쪽에도 overflow 가 없다. `min-h-full` 은 «최소» 높이라 body 가
          더 커질 수 있고, 안의 `h-dvh`(동적 뷰포트 높이)가 `h-full`(=100%)보다
          클 수 있는 순간 — 모바일 브라우저 UI 가 접히거나 스크롤바가 생기는
          그 순간 — body 가 «자기 스크롤바» 를 만든다. 그것이 두 번째 스크롤이다.

       🔴 그래서 AppShell 을 고치지 않는다. 그쪽은 맞다. 바깥을 뷰포트에
          «고정» 한다 — html·body 를 h-dvh + overflow-hidden 으로 닫으면
          페이지 스크롤은 main 하나뿐이 된다.
       🔴 `min-h-full` 을 지운다 — 「최소」가 아니라 「정확히 한 화면」이어야 한다.
          남겨 두면 같은 증상이 다시 난다. */
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-dvh overflow-hidden antialiased`}>
      <body className="h-dvh overflow-hidden flex flex-col bg-background text-text-primary">{children}</body>
    </html>
  );
}
