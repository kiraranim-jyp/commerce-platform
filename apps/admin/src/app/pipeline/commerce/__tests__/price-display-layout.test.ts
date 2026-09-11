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
  it("네 가격 그룹은 각각 한 번씩만 렌더된다", () => {
    // UX 2.4 — A/D(사슬) · B(글로벌 시장) · C(한국 경쟁시장). 한 그룹이 두 번
    // 그려지는 순간 둘 중 하나만 고쳐지는 날이 오고, 같은 상품이 화면 위아래에서
    // 다른 값을 말한다.
    expect(jsxUses(panel, "PriceChainView")).toBe(1);
    expect(jsxUses(panel, "GlobalMarketCardView")).toBe(1);
    expect(jsxUses(panel, "MarketContextView")).toBe(1);
  });

  it("국내 편집샵 관측을 '해외 시장'이라고 부르던 블록이 없다", () => {
    // DOMESTIC_SHOP은 market_code를 저장하지 않아 전부 null인데, 예전에는 그
    // null을 splitByTargetMarket이 "한국이 아님"으로 분류해서 국내 비교상품
    // 판매처들이 "🌎 해외 시장 참고" 아래 서 있었다 — 이번 지시가 없애라고 한
    // 바로 그 혼동을 화면이 스스로 만들고 있었다.
    expect(panel).not.toContain("overseasMarketRows");
    // 국내 비교상품 판매처 목록을 시장으로 가르는 호출 자체가 없다.
    expect(panel).not.toContain("splitByTargetMarket(");
    expect(panel).not.toContain("overseasRows=");
  });

  it("예상 수익·착지원가·구매가는 사슬 밖에서 다시 그려지지 않는다", () => {
    // 사슬이 이미 원가 → 판매가 → 수익을 순서대로 보여준다. 접힌 상세 안에
    // 사본을 두면 같은 숫자가 두 번 뜬다(그게 이번 지시의 "반복 표시" 항목이다).
    expect(panel).not.toContain("📈 예상 수익");
    expect(panel).not.toContain("📦 착지원가");
    expect(panel).not.toContain("💰 현재 구매가");
  });

  it("추천 판매가는 한 곳에서만 그려지고, 사슬 안으로 들어가지 않는다", () => {
    // 사슬 안에 넣으면 "내 판매가격"으로 읽힌다(이미 그 가격으로 팔기로 된 줄
    // 안다). 사본을 만들면 둘 중 하나만 고쳐지는 순간 추천가가 둘이 된다.
    expect((panel.match(/recommendation\.recommendedPrice\.toLocaleString\(\)/g) ?? []).length).toBe(1);
    const chainAt = panel.indexOf("<PriceChainView");
    // 주석에도 같은 문구가 있어서 버튼 JSX 그대로를 찾는다.
    const detailToggleAt = panel.indexOf("{caret(showMarketDetail)} 왜 이렇게 판단했나요?");
    const recommendedAt = panel.indexOf("🏷 최종 추천 판매가");
    // 사슬 바로 아래 — 상세를 펼쳐야만 보이는 자리가 아니다.
    expect(recommendedAt).toBeGreaterThan(chainAt);
    expect(recommendedAt).toBeLessThan(detailToggleAt);
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

/**
 * UX 2.4(CEO 지시, 2026-09-11) — 판단 → 가격 → 글로벌 → 국내 경쟁 → 근거.
 *
 * 읽는 순서는 계산 규칙이 아니라 배치 규칙이라 순수 함수로 표현할 수가 없다.
 * 그런데 깨지는 방식은 늘 같다: 누군가 블록 하나를 "여기가 더 잘 보이니까"
 * 위로 올린다. 그 순간 셀러는 국내 경쟁가를 먼저 읽고 그것을 판매자 가격으로
 * 착각한다 — 이번 지시의 출발점이 정확히 그 화면이다.
 */
describe("가격 영역은 정해진 순서로 읽힌다", () => {
  const verdictAt = panel.indexOf("{FINAL_VERDICT_COPY[sellerDecision.finalVerdict].icon}");
  const chainAt = panel.indexOf("<PriceChainView");
  const globalAt = panel.indexOf("<GlobalMarketCardView");
  const contextAt = panel.indexOf("<MarketContextView");
  const evidenceAt = panel.indexOf("<MiAxisStars");

  it("판단 → 가격 → 글로벌 → 국내 경쟁 → 근거 순서로 배치된다", () => {
    expect(verdictAt).toBeGreaterThan(-1);
    expect(chainAt).toBeGreaterThan(verdictAt);
    expect(globalAt).toBeGreaterThan(chainAt);
    expect(contextAt).toBeGreaterThan(globalAt);
    expect(evidenceAt).toBeGreaterThan(contextAt);
  });

  it("글로벌 시장 카드는 사슬 안으로 접혀 들어가지 않는다", () => {
    // 사슬은 "내가 치르는 돈"의 계산이다. $53(US)·€37(FR)은 내가 치르는 돈이
    // 아니라 이 판매처가 그 시장에서 받는 값이라, 사슬에 넣으면 어느 줄이
    // 원가 계산에 들어갔는지 읽을 수 없게 된다.
    expect(panel).toContain("<PriceChainView rows={priceChain}");
    expect(panel).not.toContain("globalMarketCard={priceChain");
    expect(panel.indexOf("<GlobalMarketCardView")).toBeGreaterThan(panel.indexOf("<PriceChainView"));
  });
});

describe("가격 상세는 접히고, 같은 숫자는 두 번 그려지지 않는다", () => {
  it("접힌 기본 화면은 사슬의 SUMMARY 줄만 그린다", () => {
    // 무엇을 접을지는 price-hierarchy.ts의 tier가 정한다 — 화면이 key나 role을
    // 세어 고르기 시작하면 값이 하나 늘 때마다 여기를 또 고쳐야 한다.
    expect(panel).toContain('rows.filter((row) => row.tier === "SUMMARY")');
    expect(panel).toContain("showDetail={showPriceDetail}");
  });

  it("국내 비교상품 평균가는 판단 카드에만 있다 — 근거 블록이 사본을 갖지 않는다", () => {
    // 대표값(평균가)은 판단 카드가, 분포의 폭(최저~최고)은 근거 블록이 말한다.
    expect(panel).not.toContain("평균가`}");
    expect(panel).toContain("domesticCompetition.highestPriceKrw");
  });

  it("판매자 신고 국가는 기본 화면에 없고 펼친 상세에만 있다", () => {
    // 기본 화면에 "독일 / 판매자 신고 국가 ES"를 나란히 두면(실측: Bobo Choses는
    // 모든 시장에서 country=ES) 시장과 신고 국가를 가르려던 표시가 오히려 둘을
    // 섞어 보이게 한다.
    expect(panel).toContain("showDeclaredCountry && (");
    expect(panel).toContain("{showDetail && (");
    // 판단 카드의 글로벌 시장 줄은 기본 상태에서 신고 국가를 그리지 않는다.
    const rowView = panel.slice(panel.indexOf("function GlobalMarketRowView"));
    const declaredAt = rowView.indexOf("판매자 신고 국가");
    const detailGateAt = rowView.indexOf("{showDetail && (");
    expect(declaredAt).toBeGreaterThan(detailGateAt);
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
