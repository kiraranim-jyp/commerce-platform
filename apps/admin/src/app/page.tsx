import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/business-info";
import { BrandMark } from "@/components/layout/BrandMark";
import { Footer } from "@/components/layout/Footer";
import { AnalysisPreview, ListingPreview, VerdictPreview } from "@/components/landing/ProductPreview";

/**
 * LANDING-3.0(CPO 지시, 2026-09-08) — Landing 전면 개편.
 *
 * 2.0의 문제는 "카드만 반복되고 제품이 안 보인다"였다. 그래서 이번 개편의
 * 중심은 문구가 아니라 **제품 화면을 Hero 바로 아래로 끌어올린 것**이다(§2).
 * 5초 안에 남겨야 할 인식은 하나다:
 *
 *   "상품 등록 툴이 아니라, 팔 상품을 먼저 골라주는 서비스"
 *
 * 제품 화면 재현에 쓴 어휘는 전부 실제 코드에서 가져왔다(ProductPreview.tsx
 * 주석 참고). Landing이 제품보다 앞서 말하면, 들어온 사람이 기대한 화면과
 * 실제 화면이 달라진다.
 *
 * 넣지 않은 것(§15): 고객 수·매출·평점·후기·"N배 빠름" 같은 수치. 근거가
 * 없다. 초기 서비스가 검증되지 않은 숫자를 쓰면 그 순간 신뢰를 잃는다.
 * 구현되지 않은 기능(주문관리·재고 자동화·SEO 분석 등)도 넣지 않았다.
 *
 * client component를 쓰지 않는다(§16) — FAQ는 네이티브 <details>다.
 */
export const metadata = {
  title: "따져(TTAEJYO) — 등록하기 전에, 팔아도 되는 상품인지 따져보세요",
  description:
    "해외 상품 URL 하나로 국내 시장성·가격 경쟁력·수익성을 먼저 확인하는 상품 분석 서비스. 동일상품 매칭, 원가와 마진, 판매 판단까지 등록 전에 따져봅니다.",
  openGraph: {
    title: "따져(TTAEJYO) — 따져보고 판매하라",
    description: "해외 상품, 바로 등록하지 마세요. 등록은 판단이 끝난 다음입니다.",
    siteName: BUSINESS_INFO.serviceName,
  },
};

const NAV = [
  { href: "#checklist", label: "서비스" },
  { href: "#how", label: "어떻게 판단하나요?" },
  { href: "#features", label: "주요 기능" },
  { href: "#faq", label: "FAQ" },
];

/** §3 — 사회적 증거 대신 "등록 전 확인해야 할 것"을 신뢰 축으로 쓴다. */
const CHECKLIST = [
  {
    q: "국내에서 이미 팔리고 있을까?",
    a: "비슷한 상품이 아니라 정말 같은 상품이 팔리고 있는지 확인합니다.",
  },
  { q: "이 가격에 팔아도 남을까?", a: "상품가와 국제배송비를 기준으로 국내 판매가격과 비교합니다." },
  { q: "인증이나 판매 리스크는 없을까?", a: "KC 등 등록 전에 확인이 필요한 항목을 점검합니다." },
  { q: "그래서, 팔아도 될까?", a: "분석 결과를 바탕으로 판매 판단까지 한 번에 봅니다." },
];

/** §4 — 경쟁사가 아니라 "기존 행동 순서"와 비교한다. */
const OLD_WAY = ["상품 발견", "상품 등록", "가격 설정", "판매 시작", "나중에 문제 발견"];
const NEW_WAY = ["상품 발견", "시장 확인", "가격 비교", "원가·마진 계산", "판매 리스크 확인", "판매 판단", "등록"];

/** §5 — 기능 나열이 아니라 판단 과정 순서로 묶는다. 현재 구현된 것만. */
const FEATURES = [
  { no: "01", tag: "상품 수집", title: "상품 URL 하나로 시작", detail: "해외 상품 주소를 넣으면 상품 정보를 가져와 분석을 시작합니다." },
  {
    no: "02",
    tag: "국내 시장 확인",
    title: "국내에서 실제로 팔리고 있는지 확인",
    detail: "동일상품 · 동일상품 추정 · 유사상품을 구분해 국내 시장 가격을 확인합니다.",
  },
  { no: "03", tag: "가격 경쟁력", title: "내 원가로 팔아도 경쟁력이 있는지", detail: "상품가와 국제배송비를 기준으로 국내 판매가격과 비교합니다." },
  { no: "04", tag: "수익성", title: "팔면 실제로 남는지 계산", detail: "목표 마진을 기준으로 판매 가능 여부를 판단합니다." },
  { no: "05", tag: "판매 판단", title: "그래서 팔까? 말까?", detail: "분석 결과를 한눈에 보고 등록 여부를 결정합니다." },
  { no: "06", tag: "등록 준비", title: "판단이 끝났다면 등록 준비", detail: "스마트스토어 · 쿠팡 등록에 필요한 상품 정보를 준비합니다." },
];

const OUTCOMES = [
  { icon: "🟢", title: "판매해볼 만한", detail: "시장성과 수익성을 확인했습니다.", tone: "border-success/30 bg-success-soft" },
  { icon: "🟡", title: "추가 확인 필요", detail: "일부 정보가 부족합니다. 확인 후 판단하세요.", tone: "border-warning/30 bg-warning-soft" },
  { icon: "🔴", title: "피해야 할", detail: "현재 조건에서는 판매 경쟁력이 낮습니다.", tone: "border-error/30 bg-error-soft" },
];

const AUDIENCE = [
  { title: "해외구매대행을 시작하는 셀러", detail: "무엇을 팔아야 할지 막막하다면, 등록 전에 상품부터 검증하세요." },
  { title: "상품을 많이 소싱하는 셀러", detail: "수십·수백 개를 일일이 판단하지 않고 시장성과 수익성을 빠르게 비교하세요." },
  { title: "소싱 담당자", detail: "상품 URL을 전달받아 국내 판매 가능성을 빠르게 확인하세요." },
  { title: "등록은 많지만 판매가 고민인 셀러", detail: "\"등록했는데 안 팔리는 상품\"을 줄이는 것부터 시작하세요." },
];

/** §10 — 구매 결정에 필요한 질문. 현재 구현 범위만 답한다. */
const FAQ = [
  {
    q: "어떤 해외 쇼핑몰 상품을 분석할 수 있나요?",
    a: "해외 쇼핑몰의 상품 상세 페이지 주소를 넣으면 분석합니다. 사이트 구조에 따라 가져올 수 있는 정보의 범위가 달라질 수 있고, 아직 지원하지 않는 사이트는 직접 확인이 필요할 수 있습니다.",
  },
  { q: "상품 URL만 넣으면 되나요?", a: "네. 상품 주소를 넣으면 상품 정보 추출부터 국내 시장 확인, 수익성 계산까지 이어집니다." },
  {
    q: "국내에서 같은 상품이 판매되는지도 확인하나요?",
    a: "확인합니다. 국내 편집샵과 오픈마켓의 판매 상품을 찾아 가격을 함께 보여줍니다.",
  },
  {
    q: "유사상품과 동일상품을 구분하나요?",
    a: "구분합니다. 상품 식별정보가 일치하면 동일상품, 상품명·브랜드로만 추정되면 동일상품 추정, 그 아래는 유사상품으로 표시합니다. 확실하지 않은 것을 확실하다고 말하지 않습니다.",
  },
  {
    q: "판매가격과 예상 수익도 계산하나요?",
    a: "상품가와 국제배송비를 기준으로 예상 마진을 계산합니다. 판매 채널 수수료나 국내 배송 조건 등은 설정한 값에 따라 달라집니다.",
  },
  { q: "스마트스토어와 쿠팡 등록도 지원하나요?", a: "판단 이후 등록 준비를 지원합니다. 가격이 자동으로 바뀌거나 자동으로 등록되지는 않습니다." },
  {
    q: "분석 결과가 좋지 않은 상품도 확인할 수 있나요?",
    a: "네. 오히려 그게 핵심입니다. 판매 경쟁력이 낮거나 정보가 부족한 상품도 그 이유와 함께 보여줍니다.",
  },
  { q: "지금 바로 사용할 수 있나요?", a: "현재는 운영자가 발급한 계정으로 이용하는 Beta 단계입니다." },
];

/** 반복되는 CTA. §14 — CTA는 페이지 전체에서 반복한다. */
function PrimaryCta({ label = "무료로 시작하기" }: { label?: string }) {
  return (
    <Link
      href="/login"
      className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
    >
      {label}
    </Link>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold leading-snug tracking-tight text-text-primary sm:text-2xl">{children}</h2>
      {sub && <p className="mt-2 text-sm text-text-secondary">{sub}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      {/* ── 01. Header(§12) ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <BrandMark size={22} />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-text-primary">{BUSINESS_INFO.serviceName}</div>
            <div className="text-[10px] font-medium tracking-wide text-text-tertiary">
              {BUSINESS_INFO.serviceNameEn}
            </div>
          </div>
        </Link>

        {/* 좁은 화면에서는 앵커를 숨긴다 — 햄버거를 만들면 client component가
            필요해지고(§16 성능), Landing에서 가장 중요한 건 CTA다. */}
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
        {/* ── 02. Hero + 03. 제품 화면(§2) ───────────────────────────
            제품 화면을 Hero 바로 아래 같은 섹션에 둔다 — 첫 화면에서
            제품의 존재가 보여야 한다는 것이 이번 개편의 핵심이다. */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-14 pt-14 sm:pb-20 sm:pt-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium text-text-tertiary sm:text-sm">
              해외 상품을 찾았다면, 등록하기 전에 먼저 따져보세요.
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl">
              따져보고 판매하라
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-text-secondary sm:text-base">
              해외 상품 URL 하나로 국내 시장성 · 가격 경쟁력 · 수익성을 확인하고, 팔아볼 상품인지 먼저 판단하세요.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
              <div className="w-full sm:w-auto [&>a]:block [&>a]:w-full sm:[&>a]:inline-block sm:[&>a]:w-auto">
                <PrimaryCta />
              </div>
              <a
                href="#how"
                className="w-full rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-background sm:w-auto"
              >
                어떻게 판단하는지 보기
              </a>
            </div>
          </div>

          <div className="mt-12 grid gap-3 lg:grid-cols-2">
            <VerdictPreview />
            <div className="grid gap-3">
              <AnalysisPreview />
              <ListingPreview />
            </div>
          </div>
        </section>

        {/* ── 04. 등록 전 확인할 것(§3) ──────────────────────────────── */}
        <section id="checklist" className="scroll-mt-14 border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
            <SectionTitle>상품을 등록하기 전에, 먼저 확인해야 할 것들이 있습니다.</SectionTitle>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {CHECKLIST.map((c) => (
                <div key={c.q} className="rounded-md border border-border bg-background p-4">
                  <p className="text-sm font-medium text-text-primary">{c.q}</p>
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">{c.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 05. 기존 방식 vs 따져(§4) ──────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
            <SectionTitle>상품을 찾았다고 바로 등록하지 마세요.</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-background p-4">
                <p className="mb-3 text-[11px] font-medium text-text-tertiary">기존 방식</p>
                <ol className="space-y-1.5">
                  {OLD_WAY.map((s, i) => (
                    <li
                      key={s}
                      className={`rounded px-2.5 py-1.5 text-xs sm:text-sm ${
                        i === OLD_WAY.length - 1
                          ? "bg-error-soft font-medium text-error"
                          : "bg-surface text-text-tertiary"
                      }`}
                    >
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary-soft p-4">
                <p className="mb-3 text-[11px] font-medium text-primary">따져</p>
                <ol className="space-y-1.5">
                  {NEW_WAY.map((s, i) => (
                    <li
                      key={s}
                      className={`rounded bg-surface px-2.5 py-1.5 text-xs sm:text-sm ${
                        i === NEW_WAY.length - 1 ? "font-semibold text-text-primary" : "text-text-secondary"
                      }`}
                    >
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <p className="mt-6 rounded-md border border-primary/30 bg-primary-soft px-4 py-3.5 text-center text-base font-semibold text-text-primary sm:text-lg">
              등록은 판단이 끝난 다음입니다.
            </p>
          </div>
        </section>

        {/* ── 06+07. 판단 프로세스 = 핵심 기능(§5) ───────────────────── */}
        <section id="how" className="scroll-mt-14 border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
            <div id="features" className="scroll-mt-14">
              <SectionTitle sub="기능을 따로 배우지 않아도, 판단 순서대로 따라가면 됩니다.">
                상품 하나를 등록하기까지, 따져야 할 것을 한 곳에서
              </SectionTitle>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.no} className="rounded-md border border-border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{f.no}</span>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-tertiary">{f.tag}</span>
                  </div>
                  <p className="mt-2.5 text-sm font-medium text-text-primary">{f.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{f.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 08. 3초 판단(§7) ──────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-xl font-semibold leading-snug tracking-tight text-text-primary sm:text-2xl">
                  복잡한 분석은 우리가 하고,
                  <br /> 판단은 당신이 빠르게 합니다.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-text-secondary">
                  국내 시장 가격, 해외 원가, 예상 마진, 동일상품 매칭 상태를 한 화면에서 봅니다. 숫자를 직접 비교하지
                  않아도 지금 등록해도 되는 상품인지 먼저 보입니다.
                </p>
                <div className="mt-6">
                  <PrimaryCta />
                </div>
              </div>
              <VerdictPreview />
            </div>
          </div>
        </section>

        {/* ── 09. 대상 사용자(§8) ────────────────────────────────────── */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
            <SectionTitle>이런 셀러에게 특히 유용합니다.</SectionTitle>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {AUDIENCE.map((a) => (
                <div key={a.title} className="rounded-md border border-border bg-background p-4">
                  <p className="text-sm font-medium text-text-primary">{a.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">{a.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 10. 결과(§9) ──────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
            <SectionTitle>
              결국 필요한 건 분석 결과가 아니라 &ldquo;그래서 팔까?&rdquo;에 대한 답입니다.
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              {OUTCOMES.map((o) => (
                <div key={o.title} className={`rounded-lg border p-5 ${o.tone}`}>
                  <p className="text-2xl">{o.icon}</p>
                  <p className="mt-2.5 text-base font-semibold text-text-primary">{o.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-secondary sm:text-sm">{o.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 11. FAQ(§10) ──────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-14 border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
            <SectionTitle>자주 묻는 질문</SectionTitle>
            <div className="space-y-2">
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

        {/* ── 12. Final CTA(§11) ────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-3xl px-5 py-16 text-center sm:py-20">
            <h2 className="text-2xl font-semibold leading-snug tracking-tight text-text-primary sm:text-3xl">
              등록하기 전에,
              <br /> 한 번 더 따져보세요.
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
              상품 URL 하나로 국내 시장과 가격, 수익성을 확인하고 판매할 상품을 선택하세요.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
              <div className="w-full sm:w-auto [&>a]:block [&>a]:w-full sm:[&>a]:inline-block sm:[&>a]:w-auto">
                <PrimaryCta />
              </div>
              <a
                href="#checklist"
                className="w-full rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-background sm:w-auto"
              >
                서비스 둘러보기
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
