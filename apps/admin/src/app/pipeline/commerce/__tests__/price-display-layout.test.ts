import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * UX 2.3(CEO 지시, 2026-09-11) — 같은 가격이 화면에 두 번 뜨지 않는다.
 *
 * ── 왜 소스 텍스트를 검사하는가 ──────────────────────────────────────────
 * single-action-center.test.ts와 같은 이유다. 이건 계산 규칙이 아니라 **배치
 * 규칙**이라 순수 함수로 표현할 수가 없는데, 깨지는 방식은 늘 똑같다: 누군가
 * "여기서도 예상 수익이 보이면 좋겠는데"라며 한 벌 더 렌더한다. 그 사본 중
 * 하나만 고쳐지는 순간 같은 상품이 화면 위아래에서 다른 수익을 말한다 — 이
 * 저장소에서 반복된 버그 유형이라 타입으로 못 막으면 숫자로라도 못박는다.
 *
 * 이 테스트가 실패하면 고쳐야 할 것은 테스트가 아니라 배치다.
 */
function read(relativeToThisFile: string): string {
  return readFileSync(fileURLToPath(new URL(relativeToThisFile, import.meta.url)), "utf8");
}

const panel = read("../DomesticPriceIntelligencePanel.tsx");

/** JSX 사용처만 센다(import/정의와 헷갈리지 않게). */
function jsxUses(source: string, component: string): number {
  return (source.match(new RegExp(`<${component}\\b`, "g")) ?? []).length;
}

describe("가격 계층은 화면에 한 벌만 있다", () => {
  it("수익성 사슬과 시장 맥락은 각각 한 번씩만 렌더된다", () => {
    expect(jsxUses(panel, "PriceChainView")).toBe(1);
    expect(jsxUses(panel, "MarketContextView")).toBe(1);
  });

  it("해외 시장 목록은 시장 맥락 블록 안에서만 그려진다", () => {
    // 예전에는 판단 카드에서 한참 떨어진 화면 맨 아래에 같은 블록이 따로 있었다.
    // 두 벌이 되면 토글 상태가 갈라져 "한쪽만 열린" 화면이 된다.
    expect((panel.match(/overseasMarketRows\.map\(/g) ?? []).length).toBe(0);
    expect((panel.match(/overseasRows=\{overseasMarketRows\}/g) ?? []).length).toBe(1);
  });

  it("예상 수익·착지원가·구매가는 사슬 밖에서 다시 그려지지 않는다", () => {
    // 사슬이 이미 원가 → 판매가 → 수익을 순서대로 보여준다. 접힌 상세 안에
    // 사본을 두면 같은 숫자가 두 번 뜬다(그게 이번 지시의 "반복 표시" 항목이다).
    expect(panel).not.toContain("📈 예상 수익");
    expect(panel).not.toContain("📦 착지원가");
    expect(panel).not.toContain("💰 현재 구매가");
  });

  it("국내 비교상품 분포를 '한국 시장 가격'이라고 부르지 않는다", () => {
    // 그 이름은 원본 판매자의 한국 표시가와 겹친다 — 한 라벨이 두 사실을
    // 가리키던 자리다. 라벨은 price-hierarchy.ts의 표에서만 나온다.
    expect(panel).not.toContain('label="한국 시장 최저가"');
    expect(panel).not.toContain('label="한국 시장 평균가"');
  });
});

describe("③④는 요약만 보여준다", () => {
  it("요약 분기가 사슬보다 먼저 반환된다 — 요약 화면에 사슬이 그려지지 않는다", () => {
    // 요약 분기는 loading / !data / 정상 세 곳에 있다. 사슬과 비교해야 하는
    // 것은 마지막(정상 데이터) 분기다.
    const summaryBranchAt = panel.lastIndexOf('if (presentation === "SUMMARY")');
    const chainAt = panel.indexOf("<PriceChainView");
    const contextAt = panel.indexOf("<MarketContextView");
    expect(summaryBranchAt).toBeGreaterThan(-1);
    expect(chainAt).toBeGreaterThan(summaryBranchAt);
    expect(contextAt).toBeGreaterThan(summaryBranchAt);
  });

  it("요약 한 줄은 국내 비교상품 · 착지원가 · 예상 마진 세 숫자를 갖는다", () => {
    const summaryBranchAt = panel.lastIndexOf('if (presentation === "SUMMARY")');
    const fullReturnAt = panel.indexOf('<CollapsibleSection title="Market Intelligence" defaultOpen>', summaryBranchAt);
    const summaryBlock = panel.slice(summaryBranchAt, fullReturnAt);
    for (const key of ["targetMarketPrice", "landedCost", "estimatedMargin"]) {
      expect(summaryBlock).toContain(`n.key === "${key}"`);
    }
    // 요약은 요약이다 — 근거 목록/사슬/레이더를 여기서 그리지 않는다.
    expect(summaryBlock).not.toContain("<PriceChainView");
    expect(summaryBlock).not.toContain("<MiRadar");
  });

  it("상세로 가는 버튼이 무엇을 여는지 이름으로 말한다", () => {
    expect(panel).toContain("가격 판단 상세보기");
  });
});

describe("시장별 가격 한 줄은 시장·통화·환산을 모두 말한다", () => {
  it("원본 통화 가격 옆에 저장된 원화 환산값이 함께 온다", () => {
    // 매입처 비교가 이 블록의 존재 이유인데, €75만 보여주면 비교할 수가 없다.
    // 환율을 새로 계산하지 않고 관측 시점에 저장된 price_krw를 그대로 쓴다.
    expect(panel).toContain("원화 환산 ₩{price.priceKrw.toLocaleString()}");
    expect(panel).toContain('price.currency.toUpperCase() !== "KRW"');
  });

  it("판매자 신고 국가를 시장이라고 부르지 않는다", () => {
    // market_country(신고 국가)와 market_code(관측된 시장)는 다른 사실이다.
    expect(panel).toContain("판매자 신고 국가");
    expect(panel).not.toContain("기준 국가 {price.marketCountry");
  });
});

describe("근거 블록은 위젯이 아니라 의미로 묶인다", () => {
  const domestic = read("../DomesticShopSearch.tsx");
  const comparison = read("../ComparisonShopSearch.tsx");

  it("국내 블록 제목이 한국 시장의 비교상품임을 말한다", () => {
    expect(domestic).toContain('title="🇰🇷 한국 시장 · 국내 비교상품 (베타)"');
  });

  it("해외 블록 제목이 글로벌 시장임을 말한다", () => {
    expect(comparison).toContain('title="🌎 글로벌 시장 · 해외 판매처 가격 (베타)"');
  });

  it("해외 표의 국가 열은 '시장'이 아니라 '판매처 국가'다", () => {
    // shopCountry는 그 상점이 스스로 신고한 국가이지 관측된 시장이 아니다.
    // "시장"이라고 부르면 ES로 신고한 판매처의 가격이 스페인 시장 가격이 된다.
    expect(comparison).toContain(">판매처 국가<");
    expect(comparison).not.toContain(">국가<");
  });

  it("원화 환산값에는 반드시 '원화 환산' 라벨이 붙는다", () => {
    // "약 ₩64,820"만 있으면 그게 한국에서 관측된 가격인지 우리가 환율로 만든
    // 값인지 알 수 없다 — 그 혼동이 "€37 ≈ ₩57,756"을 만든 방식이다.
    expect((comparison.match(/원화 환산/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(read("../SourceDataView.tsx")).toContain("원화 환산 {formatKrw(krw.amountKrw)}");
  });
});
