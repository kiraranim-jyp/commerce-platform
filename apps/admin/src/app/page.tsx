import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/business-info";
import { BrandMark } from "@/components/layout/BrandMark";
import { Footer } from "@/components/layout/Footer";

/**
 * CEO-11(CPO 지시, 2026-09-08) — Landing 2.0.
 *
 * 목표는 "예쁜 홈페이지"가 아니라 10초 안에 이 문장을 남기는 것이다:
 *
 *   "많이 등록하기 전에, 팔아도 되는 상품인지 먼저 따져본다."
 *
 * 한 섹션 = 하나의 질문(§15) 구조로 배열한다. 섹션이 늘어난 만큼 각 섹션은
 * 짧게 유지한다 — 정보량을 늘리려고 만든 게 아니라 질문 순서를 만든 것이다.
 *
 * 이 파일은 client component가 아니다(§18). 상호작용이 필요한 곳은 FAQ뿐이고
 * 네이티브 <details>로 처리해서 JS를 추가하지 않는다. 이미지도 쓰지 않는다.
 *
 * 절대 넣지 않은 것(§14/§20): 고객 수·매출·후기·평점·"N배 빠름" 같은 수치,
 * 경쟁사 비교. 초기 서비스라 검증되지 않은 숫자를 쓰는 순간 신뢰를 잃는다.
 * 기능도 현재 구현된 범위만 적었다.
 */
export const metadata = {
  title: "따져(TTAEJYO) — 등록하기 전에, 팔아도 되는 상품인지 따져보세요",
  description:
    "해외 상품 URL 하나로 국내 시장성과 수익성을 먼저 확인하는 상품 분석 서비스. 국내 판매 현황, 원가와 마진, 판매 여부 판단까지 등록 전에 따져봅니다.",
  openGraph: {
    title: "따져(TTAEJYO) — 따져보고 판매하라",
    description: "해외 상품, 바로 등록하지 마세요. 국내에서 팔릴지 먼저 확인하세요.",
    siteName: BUSINESS_INFO.serviceName,
  },
};

/** Header 앵커. 과도한 메뉴를 만들지 않는다(§2). */
const NAV = [
  { href: "#problem", label: "서비스" },
  { href: "#how", label: "어떻게 따지나요?" },
  { href: "#features", label: "주요 기능" },
  { href: "#faq", label: "FAQ" },
];

/** §5 — 기능 이름이 아니라 판매를 결정하는 과정. */
const STEPS = [
  { no: "01", title: "상품 URL", detail: "해외 상품을 가져옵니다." },
  { no: "02", title: "상품 분석", detail: "상품명·가격·옵션·이미지 등을 확인합니다." },
  { no: "03", title: "국내 시장", detail: "국내 판매 상품과 시장 신호를 확인합니다." },
  { no: "04", title: "수익성", detail: "상품가격과 해외배송비를 기준으로 판매 가능성을 계산합니다." },
  { no: "05", title: "판매 판단", detail: "판매 / 주의 / 손실 가능성을 판단합니다." },
];

/** §6 — 현재 구현된 기능만. */
const FEATURES = [
  { title: "상품 URL 하나로 시작", detail: "해외 상품 주소를 입력하면 분석이 시작됩니다." },
  { title: "국내 시장 확인", detail: "국내에서 판매 중인 상품과 가격 정보를 비교합니다." },
  {
    title: "동일상품 · 유사상품 구분",
    detail: "무조건 같은 상품이라고 단정하지 않습니다. 매칭 신뢰도를 함께 표시합니다.",
  },
  { title: "원가와 마진 확인", detail: "상품 가격과 국제배송비를 기준으로 남는 금액을 봅니다." },
  { title: "판매 판단", detail: "\"팔아도 되는 상품인가\"를 가장 먼저 보여줍니다." },
  { title: "상품 등록 준비", detail: "판단이 끝난 뒤 스마트스토어·쿠팡 등록을 준비합니다." },
];

/** §7 — 특정 경쟁사를 지목하지 않는다. "기존 방식"과의 순서 차이만 말한다. */
const COMPARISON = [
  { before: "상품 찾기", after: "상품 검증" },
  { before: "바로 등록", after: "먼저 판단" },
  { before: "가격 입력", after: "수익성 확인" },
  { before: "등록 후 문제 발견", after: "등록 전 위험 확인" },
  { before: "많이 등록", after: "팔 수 있는 상품 선별" },
];

/** §9 — 실제 판정 용어를 왜곡하지 않는다(판매/주의/손실 가능성 3단계 그대로). */
const OUTCOMES = [
  {
    icon: "🟢",
    title: "팔아볼 만한 상품",
    detail: "시장과 수익성을 확인했고 등록 준비로 넘어갈 수 있습니다.",
    tone: "border-success/30 bg-success-soft",
  },
  {
    icon: "🟡",
    title: "조금 더 확인할 상품",
    detail: "정보가 부족하거나 마진이 애매해 추가 확인이 필요합니다.",
    tone: "border-warning/30 bg-warning-soft",
  },
  {
    icon: "🔴",
    title: "피해야 할 상품",
    detail: "원가 대비 판매가가 낮거나 손실 가능성이 있습니다.",
    tone: "border-error/30 bg-error-soft",
  },
];

const AUDIENCE = [
  { title: "해외구매대행 셀러", detail: "상품은 찾지만 매번 시장조사가 번거로운 분." },
  { title: "초보 셀러", detail: "\"이 상품을 팔아도 되는지\"부터 알고 싶은 분." },
  { title: "상품을 많이 다루는 셀러", detail: "상품 하나하나를 직접 검증할 시간이 부족한 분." },
  { title: "상품 소싱 담당자", detail: "등록 전에 시장성과 수익성을 빠르게 확인해야 하는 분." },
];

/** §11 — 모르는 것은 모른다고 적는다. 지원 범위를 부풀리지 않는다. */
const FAQ = [
  {
    q: "어떤 상품을 분석할 수 있나요?",
    a: "해외 쇼핑몰의 상품 상세 페이지 주소를 입력하면 분석합니다. 사이트 구조에 따라 가져올 수 있는 정보의 범위가 달라질 수 있습니다.",
  },
  {
    q: "모든 해외 쇼핑몰을 지원하나요?",
    a: "아니요. 지원 사이트를 계속 넓혀가고 있으며, 아직 지원하지 않는 사이트는 직접 확인이 필요할 수 있습니다. 이런 경우 화면에 \"수동 확인 필요\"로 구분해서 표시합니다.",
  },
  {
    q: "국내에서 같은 상품인지 어떻게 판단하나요?",
    a: "상품 식별정보와 상품명·브랜드 등을 함께 봅니다. 확실하지 않으면 동일상품이라고 말하지 않고 \"동일상품 추정\", \"유사상품\"처럼 신뢰도를 구분해 표시합니다.",
  },
  {
    q: "마진은 어떻게 계산하나요?",
    a: "해외 상품 가격과 국제배송비를 기준으로 계산합니다. 판매 채널 수수료나 국내 배송 조건 등은 설정한 값에 따라 달라집니다.",
  },
  {
    q: "분석 결과만 보고 바로 등록할 수 있나요?",
    a: "판단을 확인한 뒤 등록 준비 단계로 넘어갈 수 있습니다. 가격이 자동으로 바뀌거나 자동으로 등록되지는 않습니다.",
  },
  {
    q: "어떤 판매 채널을 지원하나요?",
    a: "현재는 스마트스토어와 쿠팡의 등록 준비를 지원합니다.",
  },
  {
    q: "지금 바로 사용할 수 있나요?",
    a: "현재는 운영자가 발급한 계정으로 이용하는 Beta 단계입니다.",
  },
];

export default function LandingPage() {
  return (
    // overflow-x-hidden — 모바일에서 가로 스크롤이 생기지 않게 한다(§16).
    <div className="flex min-h-full flex-col overflow-x-hidden">
      {/* ── 01. Header(§2) ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
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

        {/* 좁은 화면에서는 앵커 메뉴를 숨긴다 — 접이식 메뉴를 만들면 client
            component가 필요해지고, Landing에서 가장 중요한 건 CTA다. */}
        <nav className="hidden items-center gap-5 lg:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="text-xs text-text-secondary hover:text-text-primary">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/login" className="text-xs font-medium text-text-secondary hover:text-text-primary">
            로그인
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            무료로 시작하기
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ── 02. Hero(§3) — TTAEJYO가 뭐지? ─────────────────────────── */}
        <section className="mx-auto w-full max-w-3xl px-5 py-16 text-center sm:py-24">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl">
            따져보고 판매하라
          </h1>
          <p className="mt-4 text-base font-medium text-text-primary sm:text-lg">
            해외 상품, 바로 등록하지 마세요.
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">
            국내에서 팔릴지,
            <br /> 얼마를 받아야 남는지,
            <br /> 이미 같은 상품이 팔리고 있는지
            <br /> 먼저 확인하세요.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
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
              어떻게 따지는지 보기
            </a>
          </div>
        </section>

        {/* ── 03. 문제 제기(§4) — 왜 필요한데? ───────────────────────── */}
        <section id="problem" className="scroll-mt-14 border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <h2 className="text-xl font-semibold leading-snug tracking-tight text-text-primary sm:text-2xl">
              상품을 찾는 것보다,
              <br className="sm:hidden" /> 팔아도 되는 상품을 찾는 게 어렵습니다.
            </h2>
            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {[
                "이 상품이 한국에서 팔릴까?",
                "이미 같은 상품이 팔리고 있지는 않을까?",
                "배송비까지 넣으면 정말 남을까?",
                "얼마에 팔아야 적정 마진이 나올까?",
                "등록하기 전에 확인해야 할 것은 없을까?",
              ].map((q) => (
                <p
                  key={q}
                  className="rounded-md border border-border bg-background px-3.5 py-3 text-sm text-text-secondary"
                >
                  {q}
                </p>
              ))}
            </div>
            <p className="mt-7 text-sm font-medium text-text-primary sm:text-base">
              따져는 이 질문에 답한 다음 등록합니다.
            </p>
          </div>
        </section>

        {/* ── 04. 판단 프로세스(§5) — 어떻게 해? ─────────────────────── */}
        <section id="how" className="scroll-mt-14 border-t border-border">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <h2 className="text-center text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              상품 주소 하나로, 판매 결정까지
            </h2>
            <ol className="mt-8 space-y-2.5">
              {STEPS.map((step) => (
                <li
                  key={step.no}
                  className="flex items-start gap-3 rounded-md border border-border bg-surface p-3.5 sm:gap-4 sm:p-4"
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-primary sm:text-sm">{step.no}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-secondary sm:text-sm">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            {/* 이 문장이 제품 철학이다(§5). */}
            <p className="mt-8 rounded-md border border-primary/30 bg-primary-soft px-4 py-3 text-center text-sm font-semibold text-text-primary sm:text-base">
              등록은 판단이 끝난 다음입니다.
            </p>
          </div>
        </section>

        {/* ── 05. 핵심 기능(§6) — 뭘 해주는데? ───────────────────────── */}
        <section id="features" className="scroll-mt-14 border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">주요 기능</h2>
            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-md border border-border bg-background p-3.5 sm:p-4">
                  <p className="text-sm font-medium text-text-primary">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary sm:text-sm">{f.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 06. 차별점(§7) — 기존 방식과 뭐가 달라? ────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <h2 className="text-xl font-semibold leading-snug tracking-tight text-text-primary sm:text-2xl">
              등록을 빠르게 하는 것보다,
              <br className="sm:hidden" /> 잘못 등록하지 않는 것이 먼저니까.
            </h2>
            {/* 모바일에서 가로 스크롤이 생기지 않도록 표가 아니라 2열 그리드로
                쌓는다(§16) — 표 태그를 쓰면 좁은 화면에서 넘친다. */}
            <div className="mt-7 space-y-2">
              <div className="grid grid-cols-2 gap-2 px-1 text-[11px] font-medium text-text-tertiary">
                <span>기존 방식</span>
                <span>따져</span>
              </div>
              {COMPARISON.map((row) => (
                <div key={row.before} className="grid grid-cols-2 gap-2">
                  <p className="rounded-md border border-border bg-background px-3 py-2.5 text-xs text-text-tertiary line-through sm:text-sm">
                    {row.before}
                  </p>
                  <p className="rounded-md border border-primary/30 bg-primary-soft px-3 py-2.5 text-xs font-medium text-text-primary sm:text-sm">
                    {row.after}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 07. 결과(§9) — 그래서 내가 뭘 얻는데? ──────────────────── */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              복잡한 건 따져가 대신 따져드립니다.
            </h2>
            <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
              {OUTCOMES.map((o) => (
                <div key={o.title} className={`rounded-md border p-3.5 sm:p-4 ${o.tone}`}>
                  <p className="text-sm font-semibold text-text-primary">
                    {o.icon} {o.title}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{o.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 08. 대상 사용자(§10) ───────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              이런 분들을 위해 만들었습니다
            </h2>
            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {AUDIENCE.map((a) => (
                <div key={a.title} className="rounded-md border border-border bg-surface p-3.5 sm:p-4">
                  <p className="text-sm font-medium text-text-primary">{a.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary sm:text-sm">{a.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 09. FAQ(§11) ───────────────────────────────────────────
            <details>를 쓰면 client component 없이 접고 펼 수 있다(§18). */}
        <section id="faq" className="scroll-mt-14 border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">자주 묻는 질문</h2>
            <div className="mt-7 space-y-2">
              {FAQ.map((item) => (
                <details key={item.q} className="group rounded-md border border-border bg-background">
                  <summary className="cursor-pointer list-none px-3.5 py-3 text-sm font-medium text-text-primary marker:hidden">
                    <span className="flex items-start justify-between gap-3">
                      <span>{item.q}</span>
                      <span
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-xs text-text-tertiary transition-transform group-open:rotate-180"
                      >
                        ▾
                      </span>
                    </span>
                  </summary>
                  <p className="border-t border-border px-3.5 py-3 text-xs leading-relaxed text-text-secondary sm:text-sm">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 10. Final CTA(§12) — 한번 해볼까? ──────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-3xl px-5 py-16 text-center sm:py-20">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              등록하기 전에, 먼저 따져보세요.
            </h2>
            <p className="mt-2.5 text-sm text-text-secondary">상품 URL 하나로 시작하세요.</p>
            <Link
              href="/login"
              className="mt-7 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              무료로 시작하기
            </Link>
          </div>
        </section>
      </main>

      {/* ── 11. Footer(§13) — 기존 것을 그대로 쓴다. 없는 회사 정보를
           새로 만들지 않는다. */}
      <Footer />
    </div>
  );
}
