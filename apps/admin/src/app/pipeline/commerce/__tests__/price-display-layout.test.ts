import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "./source-text";

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
/** 주석을 걷어낸 소스 — 막아야 하는 것은 실제 호출과 렌더뿐이다(source-text.ts). */
const panelCode = stripComments(panel);

/** JSX 사용처만 센다(import/정의와 헷갈리지 않게). */
function jsxUses(source: string, component: string): number {
  return (source.match(new RegExp(`<${component}\\b`, "g")) ?? []).length;
}

describe("가격 계층은 화면에 한 벌만 있다", () => {
  it("다섯 가격 블록은 각각 한 번씩만 렌더된다", () => {
    // UX 2.4.1 — ①(원본) · ②(글로벌 시장) · ③(한국 경쟁, VS) · ④(수익성 사슬).
    // 한 그룹이 두 번 그려지는 순간 둘 중 하나만 고쳐지는 날이 오고, 같은 상품이
    // 화면 위아래에서 다른 값을 말한다.
    expect(jsxUses(panel, "OriginalPriceView")).toBe(1);
    expect(jsxUses(panel, "PriceChainView")).toBe(1);
    expect(jsxUses(panel, "MarketComparisonView")).toBe(1);
    // MI-MARKET-EVIDENCE-1 — 🌎 해외 시장도 한 번뿐이다. 요약이 두 벌이 되면
    // 한 화면에서 서로 다른 가격대가 나올 수 있다(아래 원자료 표는 별개 층이다).
    expect(jsxUses(panel, "OverseasMarketEvidenceView")).toBe(1);
    // MI-SIMPLIFY-1 — 글로벌 시장은 본문 한 줄(Hint)이고, 시장별 원자료
    // (CardView)는 그 한 줄을 펼쳤을 때만 나온다. 카드가 본문으로 되돌아오면
    // CardView가 두 번 쓰이거나 Hint 밖에서 쓰이게 되고, 아래 두 줄이 막는다.
    expect(jsxUses(panel, "GlobalMarketHint")).toBe(1);
    expect(jsxUses(panel, "GlobalMarketCardView")).toBe(1);
    const hintAt = panel.indexOf("function GlobalMarketHint");
    const hintEndAt = panel.indexOf("function GlobalMarketCardView");
    // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 원자료는 본문 흐름 밖 팝오버에 뜬다.
    const hintSource = panel.slice(hintAt, hintEndAt);
    expect(hintSource).toContain("<GlobalMarketCardView card={card} />");
    expect(hintSource).toContain("absolute left-0 top-full");
  });

  it("①은 사슬과 같은 입력에서 만들어진다 — 두 번째 원본가격이 생기지 않는다", () => {
    // buildOriginalPriceHeadline과 buildPriceChain이 같은 observedOriginPrice /
    // cost / fx를 받는다. 한쪽만 고쳐지면 ①의 £55와 ④ 첫 줄의 £55가 갈라진다.
    expect(panel).toContain("buildOriginalPriceHeadline({");
    const headlineAt = panel.indexOf("buildOriginalPriceHeadline({");
    const headlineBlock = panel.slice(headlineAt, headlineAt + 900);
    expect(headlineBlock).toContain("observedOriginPrice,");
    expect(headlineBlock).toContain("sourcePriceKrw: cost?.costKrw ?? null,");
    // 사슬도 같은 변수를 받는다 — 원본 통화를 고르는 규칙이 화면에 두 벌이 되지 않는다.
    const chainAt = panel.indexOf("const priceChain = buildPriceChain({");
    expect(panel.slice(chainAt, chainAt + 900)).toContain("observedOriginPrice,");
  });

  it("원본 판매자 한국 표시가는 지워지지 않았다 — 자리를 옮겼을 뿐이다", () => {
    // 헤드라인에서 내려왔다고 해서 사실이 사라지면 안 된다. 그 값은 ④ 사슬의
    // 출발점이자 ②의 🇰🇷 줄이고, ③의 왼쪽 칸이 그 라벨을 그대로 쓴다.
    const hierarchy = read("../price-hierarchy.ts");
    const comparison = read("../market-comparison.ts");
    expect(hierarchy).toContain('KR_MARKET_PRICE: "원본 판매자 한국 표시가"');
    expect(hierarchy).toContain('key: "KR_MARKET_PRICE"');
    expect(comparison).toContain("PRICE_MEANING_LABEL.KR_MARKET_PRICE");
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

  it("추천 판매가를 화면이 직접 포맷하지 않는다 — 사슬 안으로도 들어가지 않는다", () => {
    // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 수익성 배지 옆에 있던 🏷 두 갈래를
    // 뺐다. 그 자리를 「권장 판매가」 줄이 대신하고, 그 값은 상세 계산과 같은
    // 함수에서 온다(화면이 숫자를 만들지 않는다). 시장가 기준 추천은 되물음
    // 아래 근거 영역의 sellingSummary가 문장으로 그대로 말한다.
    expect((panel.match(/recommendation\.recommendedPrice\.toLocaleString\(\)/g) ?? []).length).toBe(0);
    // 🏷 두 줄은 화면 어디에도 없다. 권장 판매가는 사슬의 한 줄로 서고,
    // 그 값은 buildPriceChain이 profitability에서 골라 온 문자열이다.
    expect(panel).not.toContain("🏷 최종 추천 판매가");
    expect(panel).not.toContain("🏷 추천 판매가");
    const hierarchy = read("../price-hierarchy.ts");
    expect(hierarchy).toContain('RECOMMENDED_PRICE: "권장 판매가"');
    expect(hierarchy).toContain("value: profit != null ? formatKrwAmount(profit.recommendedPriceKrw) : null,");
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
    const comparisonAt = panel.indexOf("<MarketComparisonView");
    expect(summaryBranchAt).toBeGreaterThan(-1);
    expect(chainAt).toBeGreaterThan(summaryBranchAt);
    expect(comparisonAt).toBeGreaterThan(summaryBranchAt);
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
 * UX 2.4.1(CEO 지시, 2026-09-11) — 판단 → ① 원본 → ② 글로벌 → ③ 한국 경쟁 →
 * ④ 수익성 → ⑤ 근거.
 *
 * 읽는 순서는 계산 규칙이 아니라 배치 규칙이라 순수 함수로 표현할 수가 없다.
 * 그런데 깨지는 방식은 늘 같다: 누군가 블록 하나를 "여기가 더 잘 보이니까"
 * 위로 올린다. UX 2.4에서는 사슬(④)이 맨 앞이었고, 그 첫 줄이 실측 관측 때문에
 * 원화로 접혀 있어서 화면이 "원본 판매자 한국 표시가 ₩104,600"으로 열렸다 —
 * 셀러의 첫 질문("이 상품이 원래 얼마지?")에 원화로 답하는 화면이다.
 */
describe("가격 영역은 정해진 순서로 읽힌다", () => {
  const verdictAt = panel.indexOf("{FINAL_VERDICT_COPY[sellerDecision.finalVerdict].icon}");
  const originalAt = panel.indexOf("<OriginalPriceView");
  const globalHintAt = panel.indexOf("<GlobalMarketHint");
  const comparisonAt = panel.indexOf("<MarketComparisonView");
  const chainAt = panel.indexOf("<PriceChainView");
  const evidenceAt = panel.indexOf("<MiAxisStars");

  /**
   * MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — 본문에서 ②(글로벌 시장)가 빠졌다.
   * 카드 하나가 ⓘ 한 줄이 되면서 남은 순서가 한 칸씩 당겨진다:
   * 판단 → ① 원본(+ⓘ 글로벌) → ② 한국 경쟁 → ③ 수익성 → ④ 근거.
   */
  /**
   * MI-MARKET-EVIDENCE-1(CEO 지시, 2026-09-12) — 순서가 셀러의 질문 순서다:
   * 원본 €50 → 🇰🇷 한국에서 얼마에 팔리나 → 🌎 해외에서는 → 💰 얼마에 팔면 되나.
   * 🌎 해외가 국내 뒤·수익성 앞에 있어야 하는 이유가 그것이다 — 해외는 판정을
   * 바꾸는 값이 아니라 국내 가격대가 이상하지 않은지 확인해 주는 값이다.
   */
  const overseasAt = panel.indexOf("<OverseasMarketEvidenceView");

  it("판단 → 원본 → 🇰🇷 국내 → 🌎 해외 → 수익성 → 근거 순서다", () => {
    expect(verdictAt).toBeGreaterThan(-1);
    expect(originalAt).toBeGreaterThan(verdictAt);
    // ⓘ 글로벌 시장은 원본 바로 아래에 붙는다 — 원본 상품의 사실이기 때문이다.
    expect(globalHintAt).toBeGreaterThan(originalAt);
    expect(comparisonAt).toBeGreaterThan(globalHintAt);
    expect(overseasAt).toBeGreaterThan(comparisonAt);
    expect(chainAt).toBeGreaterThan(overseasAt);
    expect(evidenceAt).toBeGreaterThan(chainAt);
  });

  it("블록 제목에는 번호가 없다 — 건너뛰는 번호가 결함으로 읽히기 때문이다", () => {
    // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 번호는 순서를 감시하는 장치였지만,
    // 한국 시장 경쟁가격 블록이 조건부로 사라지는 화면에서는 ①→③ 점프가 되어
    // "내가 뭘 안 했나"를 묻게 만든다. 순서 감시는 바로 위 테스트(소스 상의
    // 렌더 순서)와 price-hierarchy.test.ts(표의 나열 순서)가 계속 맡는다.
    const hierarchy = read("../price-hierarchy.ts");
    // MI-MARKET-EVIDENCE-1 — 두 시장 제목은 국기로 갈린다(번호가 아니다).
    for (const title of ["원본 상품", "🇰🇷 국내 시장", "🌎 해외 시장"]) {
      expect(hierarchy).toContain(title);
    }
    // 글로벌 시장은 본문 순서에 없으므로 번호도 없다(price-hierarchy.test.ts가
    // 그 사실 자체를 고정한다).
    expect(hierarchy).toContain('SELLER_GLOBAL_MARKET: "🌎 판매자 글로벌 시장 가격"');
    expect(panel).toContain("PRICE_SECTION_TITLE.PROFITABILITY");
    expect(panel).toContain("PRICE_SECTION_TITLE.DECISION_EVIDENCE");
  });

  it("글로벌 시장 카드는 사슬 안으로 접혀 들어가지 않는다", () => {
    // 사슬은 "내가 치르는 돈"의 계산이다. $53(US)·€37(FR)은 내가 치르는 돈이
    // 아니라 이 판매처가 그 시장에서 받는 값이라, 사슬에 넣으면 어느 줄이
    // 원가 계산에 들어갔는지 읽을 수 없게 된다.
    expect(panel).toContain("<PriceChainView rows={priceChain}");
    expect(panel).not.toContain("globalMarketCard={priceChain");
  });

  it("한 카드 안에서 두 한국 가격을 겨루게 하지 않는다", () => {
    // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — VS 두 칸이 한 칸이 됐다. 왼쪽이던
    // "원본 판매자 한국 표시가"는 MI/PRICE-2 이후 「원본 상품」이 자기 라벨로
    // 이미 말하고, 두 칸이 같은 모양·같은 국기로 나란히 서면 "내가 살 값"과
    // "내가 경쟁할 값"이 다시 섞인다 — VS가 갈라놓으려던 혼동을 모양이
    // 되돌려 놓고 있었다.
    expect(jsxUses(panel, "ComparisonSideView")).toBe(1);
    const comparisonView = panel.slice(
      panel.indexOf("export function MarketComparisonView("),
      panel.indexOf("function ComparisonSideView("),
    );
    expect(comparisonView).toContain("side={comparison.domestic}");
    expect(comparisonView).not.toContain("side={comparison.seller}");
    expect(comparisonView).not.toContain("{comparison.versus}");
    // ①은 **다른 판매자**의 값(국내 경쟁시장)을 들고 있지 않다. MI/PRICE-2에서
    // 들어온 원본 판매자 한국 표시가는 그 판매처 자신의 페이지에서 읽은 값이라
    // 비교 대상이 아니다 — 비교는 여전히 ③ 한 곳뿐이다.
    const originalView = panel.slice(panel.indexOf("function OriginalPriceView"), panel.indexOf("function MarketComparisonView"));
    expect(originalView).not.toContain("marketContext");
    expect(originalView).not.toContain("domesticCompetition");
  });
});

/**
 * MI/PRICE-2(CEO 지시, 2026-09-12) — 관측된 시장가와 착지원가를 가르는 배치.
 *
 * 고정하려는 실제 화면(Bobo Choses B226AC043):
 *
 *   🇰🇷 한국 · en-kr    착지원가 기준    ₩162,000
 *
 * ₩162,000은 그 판매처가 한국 방문자에게 보여주는 관측된 시장가이고, 착지원가는
 * €75 → ₩116,742 + 국제배송비다. 관측된 시장가에 원가 라벨이 붙는 순간 두
 * 사실의 경계가 사라진다 — 그리고 그 혼동은 GLOBAL 판매처마다 반복된다.
 */
describe("② 글로벌 시장은 관측된 시장가만 말한다", () => {
  const globalCardView = panel.slice(
    panel.indexOf("function GlobalMarketCardView"),
    panel.indexOf("function SummaryStat"),
  );

  it("② 영역이 그리는 문자열 어디에도 착지원가가 없다", () => {
    // 주석(왜 지웠는지)은 남겨두되, 렌더되는 코드에는 없어야 한다.
    expect(stripComments(globalCardView)).not.toContain("착지원가");
    expect(stripComments(read("../global-market.ts"))).not.toContain("착지원가");
    // 배지 자체가 사라졌다 — 모양만 바꾼 것이 아니다(주석에서 언급하는 것은
    // 괜찮다. 막는 것은 렌더다 — 이 폴더의 다른 배치 테스트와 같은 규칙).
    expect(panelCode).not.toContain("착지원가 기준");
    expect(panelCode).not.toContain("row.isCostBasis");
  });

  it("🇰🇷 줄은 관측된 시장가 라벨을 달고, 그 라벨은 가격 계층 표에서 온다", () => {
    expect(globalCardView).toContain("{row.priceMeaningLabel}");
    expect(read("../global-market.ts")).toContain("PRICE_MEANING_LABEL.KR_MARKET_PRICE");
  });

  it("모든 시장 줄이 동일 상품 표시를 달고, 근거는 펼친 상세에 있다", () => {
    expect(globalCardView).toContain("{row.identity.icon} {row.identity.text}");
    const evidenceAt = globalCardView.indexOf("{row.identity.evidence}");
    const detailGateAt = globalCardView.indexOf("{showDetail && (");
    expect(evidenceAt).toBeGreaterThan(detailGateAt);
  });

  it("국내 경쟁시장의 매칭 상태는 그대로다 — 다른 개념이라 어휘도 다르다", () => {
    // ③은 *다른 판매자*의 비교 가능 상품을 matchTruth가 판정한다. 그 세 상태를
    // 글로벌 줄의 표시로 대체하거나 반대로 덮어쓰면 두 개념이 하나가 된다.
    const matchDisplay = read("../match-display.ts");
    expect(matchDisplay).toContain('label: "동일상품"');
    expect(matchDisplay).toContain('label: "동일상품 추정"');
    expect(matchDisplay).toContain('label: "유사상품"');
    // 글로벌 줄의 문구는 그 셋 중 어느 것과도 같지 않다.
    expect(read("../global-market.ts")).toContain('text: "동일 상품 · 판매자 직접 관측"');
    expect(matchDisplay).not.toContain("동일 상품 · 판매자 직접 관측");
    // 반대 방향도 막는다 — 글로벌 카드가 매칭 판정을 import해 쓰지 않는다
    // (주석에서 두 개념의 차이를 설명하는 것은 괜찮다. 막는 것은 의존이다).
    expect(stripComments(read("../global-market.ts"))).not.toContain("match-display");
  });

  it("①이 원본 판매자 한국 표시가를 들고 있다 — 관측이 사라지지 않았다", () => {
    // 배지를 지우면서 사실까지 지우면 ₩162,000이 화면에서 없어진다. 그 값은
    // 판매처 자신의 한국 페이지에서 읽은 값이라 ① 원본 상품 가격에 산다.
    const originalView = panel.slice(
      panel.indexOf("function OriginalPriceView"),
      panel.indexOf("function MarketComparisonView"),
    );
    expect(originalView).toContain("{headline.krMarket.label}");
    expect(originalView).toContain("{headline.krMarket.value}");
    // ①과 ②가 같은 줄에서 나온 같은 문자열을 쓴다(사본이 아니라 같은 사실).
    expect(panel).toContain("const judgingMarketRow = pickJudgingMarketRow(globalMarketCard);");
    expect(panel).toContain("krMarketObservation: judgingMarketRow");
  });
});

/**
 * UX 2.4.1 — 오른쪽 Action Center는 결론만 갖는다.
 *
 * 가격 상세가 거기 한 줄이라도 들어오면 왼쪽 판단 카드와 오른쪽이 같은 숫자를
 * 두 벌 들고, 한쪽만 고쳐지는 날 서로 다른 값을 말한다.
 */
describe("오른쪽 Action Center에는 가격 상세가 없다", () => {
  const actionCenter = read("../ActionCenter.tsx");

  it("판정 · 등록 준비 체크리스트 · 채널 버튼 셋뿐이다", () => {
    expect(actionCenter).toContain("판매 판단");
    expect(actionCenter).toContain("등록 전 확인");
    for (const term of ["착지원가", "원본 판매가격", "국내 비교상품", "예상 마진", "₩"]) {
      expect(actionCenter, `${term}이(가) Action Center에 있다`).not.toContain(term);
    }
  });
});

describe("가격 상세는 접히고, 같은 숫자는 두 번 그려지지 않는다", () => {
  it("④ 수익성은 언제나 사슬의 SUMMARY 줄만 그린다", () => {
    // 무엇이 요약인지는 price-hierarchy.ts의 tier가 정한다 — 화면이 key나 role을
    // 세어 고르기 시작하면 값이 하나 늘 때마다 여기를 또 고쳐야 한다.
    expect(panel).toContain('rows.filter((row) => row.tier === "SUMMARY")');
    // MI/PRICE-1(CEO 지시, 2026-09-12) — 이 뷰에 showDetail이 없다. DETAIL 층
    // (원본 가격 · 원화 환산 · 국제배송비)을 그리는 곳은 상세 계산 하나이고,
    // 여기서도 그리면 같은 접힘 안에서 같은 국제배송비가 두 번 나온다.
    expect(panel).not.toContain("showDetail={showPriceDetail}");
    expect(panel).toContain("<PriceChainView rows={priceChain} />");
  });

  it("④의 접힘은 하나뿐이고, 그 안에 들어가는 것은 상세 계산 슬롯이다", () => {
    // CPO가 지정한 모양: 요약 넷 + 토글 하나. 토글이 둘이 되는 순간 셀러는
    // 어느 쪽에 계산이 있는지 몰라 둘 다 눌러본다(UX 2.4에서 이미 겪었다).
    expect((panel.match(/setShowPriceDetail\(/g) ?? []).length).toBe(2); // 토글 1개 + 바깥 요청 동기화 1개
    expect(panel).toContain("ⓘ 가격 계산 기준 {caret(showPriceDetail)}");
    expect(panel).toContain("{showPriceDetail && (");
    expect(panel).toContain("{priceCalculationDetail}");
    // 패널이 상세 계산을 직접 만들지 않는다 — 노드로 받기만 한다. 직접 만들면
    // product와 setter 넷이 이 패널로 들어오고, 그때부터 "가격이 바뀌었으니
    // 다시 분석하자"는 배선이 생길 수 있다(주석에서 그 함수를 언급하는 것은
    // 괜찮다 — 막는 것은 호출과 렌더다).
    expect(panelCode).not.toContain("computePriceBreakdown");
    expect(panelCode).not.toContain("<PriceCalculationDetail");
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

  it("두 블록은 MI 요약의 드릴다운 대상이라 기본 펼침이 아니다", () => {
    // MI-MARKET-EVIDENCE-1(CEO 지시 ④, 2026-09-12) — 같은 시장 사실이 한 화면에
    // 두 번 서지 않게 하는 유일한 장치다. 요약이 위에 있고 표가 아래에서 함께
    // 펼쳐져 있으면, 화면을 줄일 때마다 근거가 사라지고 근거를 되살릴 때마다
    // 화면이 길어지는 왕복이 그대로 되돌아온다.
    // 주석은 "왜 버렸는지"를 설명한다 — 막아야 하는 것은 실제 prop뿐이다.
    for (const source of [stripComments(domestic), stripComments(comparison)]) {
      expect(source).not.toContain("defaultOpen");
      expect(source).toContain("open={open}");
      expect(source).toContain("onToggle={onToggle}");
    }
    // 접힘 요약 한 줄이 무엇이 열리는지 말한다("열어봐야 아는" 접힘을 만들지 않는다).
    expect(domestic).toContain("판매처 · 상품 · 가격 · 재고 · 매칭상태");
    expect(comparison).toContain("판매처 · 국가 · 상품 · 가격 · 매칭상태");
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
