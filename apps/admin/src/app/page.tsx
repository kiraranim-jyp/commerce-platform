import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/business-info";
import { BrandMark } from "@/components/layout/BrandMark";
import { Footer } from "@/components/layout/Footer";

/**
 * CEO-10(CPO 지시, 2026-09-08) — 공개 Landing.
 *
 * 이전에는 이 경로가 곧바로 /pipeline으로 redirect했다. 그래서 로그인하지
 * 않은 사람이 접속하면 "무슨 서비스인지" 알기도 전에 로그인 화면부터
 * 만났다. TTAEJYO가 내부 도구에서 외부 고객이 처음 만나는 SaaS로 넘어가는
 * 첫 단계라, 이 화면의 목적은 기능 나열이 아니라 한 문장을 남기는 것이다:
 *
 *   "해외 상품을 가져오기 전에, 한국에서 팔아도 되는지 따져보세요."
 *
 * 그래서 현재 구현된 범위(분석 → 시장 → 원가/마진 → 판단 → 등록 준비)만
 * 말한다. 가짜 수치나 실제 데이터처럼 보이는 샘플 화면은 만들지 않는다(§2-D).
 *
 * 로그인 상태에서도 이 화면은 그대로 보인다 — 자동 redirect를 넣지 않는다(§7).
 */
export const metadata = {
  title: "따져(TTAEJYO) — 따져보고 판매하라",
};

/** §2-B — 기능 이름이 아니라 "판매할지 결정하는 과정"을 보여준다. */
const STEPS = [
  { no: "01", title: "상품 URL 입력", detail: "해외 쇼핑몰 상품 주소 하나면 됩니다." },
  { no: "02", title: "상품 정보 분석", detail: "이름·이미지·옵션·카테고리를 자동으로 정리합니다." },
  { no: "03", title: "국내 시장 확인", detail: "같은 상품이 이미 얼마에 팔리고 있는지 찾습니다." },
  { no: "04", title: "원가 · 마진 계산", detail: "관세·배송비까지 넣어 실제로 남는 돈을 봅니다." },
  { no: "05", title: "판매 여부 판단", detail: "지금 등록해도 되는 상품인지 알려줍니다." },
];

/** §2-C — 셀러가 실제로 하는 질문 그대로 쓴다. */
const QUESTIONS = [
  "국내에서 팔릴까?",
  "이미 같은 상품이 팔리고 있을까?",
  "얼마에 팔아야 할까?",
  "배송비까지 넣으면 남을까?",
  "지금 등록해도 되는 상품일까?",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      {/* 상단 바 — 로그인 화면과 같은 위치에 로고를 둬서 오갈 때 흔들리지 않게. */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={22} />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-text-primary">
              {BUSINESS_INFO.serviceName}
            </div>
            <div className="text-[10px] font-medium tracking-wide text-text-tertiary">
              {BUSINESS_INFO.serviceNameEn}
            </div>
          </div>
        </Link>
        <Link
          href="/login"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          로그인
        </Link>
      </header>

      <main className="flex-1">
        {/* ── Hero(§2-A) ─────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-3xl px-5 py-16 text-center sm:py-24">
          <p className="text-xs font-medium tracking-wide text-text-tertiary">
            {BUSINESS_INFO.serviceDescription}
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl">
            따져보고 판매하라
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
            해외 상품을 가져와 팔기 전에,
            <br className="hidden sm:block" /> 국내 시장성부터 수익성까지 한 번에 따져보세요.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
            <Link
              href="/login"
              className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 sm:w-auto"
            >
              무료로 시작하기
            </Link>
            <a
              href="#how"
              className="w-full rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-background sm:w-auto"
            >
              서비스 알아보기
            </a>
          </div>
        </section>

        {/* ── 서비스가 하는 일(§2-B) ──────────────────────────────────── */}
        <section id="how" className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <h2 className="text-center text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              상품 주소 하나로, 판매 결정까지
            </h2>
            <ol className="mt-8 space-y-3">
              {STEPS.map((step) => (
                <li
                  key={step.no}
                  className="flex items-start gap-3 rounded-md border border-border bg-background p-3.5 sm:gap-4 sm:p-4"
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-primary sm:text-sm">
                    {step.no}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-secondary sm:text-sm">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 핵심 가치(§2-C) ────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <h2 className="text-xl font-semibold leading-snug tracking-tight text-text-primary sm:text-2xl">
              해외 상품, 바로 등록하지 마세요.
            </h2>
            <ul className="mt-6 space-y-2.5">
              {QUESTIONS.map((q) => (
                <li key={q} className="flex items-start gap-2.5 text-sm text-text-secondary sm:text-base">
                  <span aria-hidden="true" className="mt-px shrink-0 text-text-tertiary">
                    —
                  </span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
            <p className="mt-7 text-base font-semibold text-text-primary sm:text-lg">따져보고 판매하세요.</p>
          </div>
        </section>

        {/* ── 지원 플랫폼 — 현재 실제로 지원하는 범위만 적는다(§2-D) ──── */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-10 text-center">
            <p className="text-xs font-medium text-text-tertiary">등록 준비를 지원하는 채널</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {["스마트스토어", "쿠팡"].map((name) => (
                <span
                  key={name}
                  className="rounded-md border border-border bg-background px-3 py-1 text-xs text-text-secondary"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── 하단 CTA(§2-E) ─────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 text-center sm:py-20">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              이제 상품을 따져보세요.
            </h2>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              로그인하고 시작하기
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
