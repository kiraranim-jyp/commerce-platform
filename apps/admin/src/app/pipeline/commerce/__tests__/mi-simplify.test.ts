import { describe, expect, it } from "vitest";
import { buildGlobalMarketCard, globalMarketSummaryLine, GLOBAL_MARKET_UNAVAILABLE_NOTE } from "../global-market";
import { buildMarketComparison } from "../market-comparison";
import { miMarketCaseVerdict, NO_DOMESTIC_COMPARABLE_NOTE, PRICE_BASIS_TOOLTIP } from "../mi-market-case";
import { buildMarketContext, PRICE_SECTION_TITLE } from "../price-hierarchy";
import { readSourceAt, stripComments } from "./source-text";

/**
 * MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — MI는 판단 화면이지 가격 계산 설명
 * 화면이 아니다.
 *
 * ── 무엇이 무너지고 있었나 ───────────────────────────────────────────────
 * MI가 존재하는 이유는 질문 하나다: **"이 상품을 한국에서 이 가격에 팔 만한가?"**
 * 그 답에 필요한 사실은 셋뿐이다 — 원본 가격 · 한국에서 팔 수 있는 시장 가격 ·
 * 내 설정 마진 기준으로 팔 만한가. 그런데 기능이 하나씩 붙을 때마다 본문이
 * 길어졌다: 시장별 관측이 카드가 되고, 비교 근거가 없어도 빈 칸 두 개짜리
 * 카드가 서고, 결론이어야 할 수익성 아래에 조건마다 다른 설명 문단이 붙었다.
 *
 * ── 이 파일이 고정하는 규칙 ──────────────────────────────────────────────
 *   본문      판단에 필요한 숫자
 *   툴팁      그 숫자의 근거
 *   상세보기   원하면 확인하는 원자료
 *
 * 앞으로의 추가가 본문을 늘리는 대신 툴팁·상세로 내려앉게 만드는 것이 목적이다.
 * 이 테스트가 실패하면 고쳐야 할 것은 테스트가 아니라 그 새 블록이 앉은 층이다.
 *
 * ── 왜 소스 텍스트를 읽는가 ──────────────────────────────────────────────
 * 이 폴더의 다른 배치 테스트(price-display-layout / price-single-surface)와 같은
 * 이유다. 이건 계산 규칙이 아니라 **배치 규칙**이라 순수 함수로 표현할 수 없고,
 * 이 저장소의 vitest는 node 환경이라 .tsx를 마운트하지 않는다. 대신 "화면에
 * 무엇이 렌더되는가"를 렌더 지점의 조건과 위치로 검사한다.
 */
const panel = readSourceAt(new URL("../DomesticPriceIntelligencePanel.tsx", import.meta.url));
/** 주석은 "왜 지웠는지"를 길게 설명한다 — 막아야 하는 것은 실제 렌더뿐이다. */
const panelCode = stripComments(panel);

/** 판정 카드에서 "왜 이렇게 판단했나요?" 접힘을 뺀 나머지 = 셀러가 누르지 않고
 * 보는 **본문**. 중괄호를 세어 자르므로 블록이 커지거나 줄어도 따라간다. */
function miBody(source: string): string {
  const cardAt = source.indexOf("{hasAnyData && (");
  const cardEndAt = source.indexOf("{/* 가격 재조회", cardAt);
  const detailAt = source.indexOf("{showMarketDetail && (", cardAt);
  expect(cardAt).toBeGreaterThan(-1);
  expect(detailAt).toBeGreaterThan(cardAt);
  let depth = 0;
  let detailEndAt = detailAt;
  for (let i = detailAt; i < cardEndAt; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        detailEndAt = i + 1;
        break;
      }
    }
  }
  expect(detailEndAt).toBeGreaterThan(detailAt);
  return source.slice(cardAt, detailAt) + source.slice(detailEndAt, cardEndAt);
}

const body = miBody(panel);
const bodyCode = stripComments(body);

describe("CASE A~D는 번역되지, 노출되지 않는다", () => {
  /**
   * 엔진은 그대로다(computePriceRecommendation의 marketCase). 셀러가 보는 것은
   * 그 판정의 **번역**뿐이다 — mi-empty-state.ts가 NO_DATA/UNAVAILABLE에 대해
   * 막아 둔 것과 정확히 같은 종류의 장치다.
   */
  it("네 판정이 전부 셀러 어휘를 갖는다 — 내부 이름은 값 어디에도 없다", () => {
    const expected = [
      { code: "A" as const, icon: "🟢", title: "판매 추천", note: "설정 마진 기준 판매 가능" },
      { code: "B" as const, icon: "🟡", title: "조건부 판매", note: "설정 마진은 부족하지만 손실은 아님" },
      { code: "C" as const, icon: "🔴", title: "판매 비추천", note: "현재 시장가격으로는 원가 이하" },
      { code: "D" as const, icon: "⚪", title: "판단 보류", note: "동일상품 가격 비교 근거 부족" },
    ];
    for (const { code, ...copy } of expected) {
      expect(miMarketCaseVerdict(code)).toEqual(copy);
      // 어느 판정도 자기 내부 이름을 문구에 담지 않는다.
      for (const text of Object.values(miMarketCaseVerdict(code))) {
        expect(text).not.toMatch(/CASE/i);
        expect(text).not.toMatch(/\bmarketCase\b/);
      }
    }
  });

  it("판정이 아직 없는 상품은 없는 판정을 지어내지 않는다 — 판단 보류와 같은 자리다", () => {
    expect(miMarketCaseVerdict(null)).toEqual(miMarketCaseVerdict("D"));
    expect(miMarketCaseVerdict(undefined)).toEqual(miMarketCaseVerdict("D"));
  });

  it("🟢🟡🔴 세 마디는 서버의 SELLER_FACING_COPY를 그대로 가져다 쓴다", async () => {
    // 여기서 "판매 추천"을 다시 타이핑하면 판정 하나에 어휘가 두 벌이 되고,
    // 한쪽만 고쳐지는 날 같은 상품이 헤드라인과 ③ 수익성에서 다른 말을 한다.
    const source = stripComments(readSourceAt(new URL("../mi-market-case.ts", import.meta.url)));
    expect(source).toContain("SELLER_FACING_COPY.RECOMMENDED");
    expect(source).toContain("SELLER_FACING_COPY.CONDITIONAL");
    expect(source).toContain("SELLER_FACING_COPY.NOT_RECOMMENDED");
    const { SELLER_FACING_COPY } = await import("@commerce/pricing");
    expect(miMarketCaseVerdict("A").title).toBe(SELLER_FACING_COPY.RECOMMENDED.title);
    expect(miMarketCaseVerdict("B").title).toBe(SELLER_FACING_COPY.CONDITIONAL.title);
    expect(miMarketCaseVerdict("C").title).toBe(SELLER_FACING_COPY.NOT_RECOMMENDED.title);
  });

  it("화면은 marketCase로 직접 분기해 문장을 조립하지 않는다", () => {
    // 분기가 화면에 흩어지면 CASE가 하나 늘 때마다 화면을 뒤져야 하고,
    // 그러다 언젠가 "CASE B" 같은 내부 이름이 그대로 새어 나간다.
    expect(panelCode).not.toMatch(/marketCase\s*===\s*"[ABCD]"/);
    expect(panelCode).toContain("miMarketCaseVerdict(");
  });

  it("셀러 화면 어디에도 CASE A/B/C/D라는 글자가 렌더되지 않는다", () => {
    // 주석에서 설명하는 것은 괜찮다(이 저장소의 다른 배치 테스트와 같은 규칙).
    // 막는 것은 렌더다.
    for (const source of [panelCode, stripComments(readSourceAt(new URL("../mi-market-case.ts", import.meta.url)))]) {
      expect(source).not.toMatch(/CASE\s*[ABCD]\b/);
    }
    expect(bodyCode).not.toMatch(/\bCASE\b/i);
  });
});

describe("② 한국 시장 경쟁가격은 비교 대상이 없으면 DOM에 아예 없다", () => {
  const EMPTY_CARD = buildGlobalMarketCard({ observations: [] });

  function contextWith(domesticLowest: number | null) {
    return buildMarketContext({
      domesticBasis: domesticLowest == null ? "NONE" : "EXACT",
      domesticAveragePriceKrw: domesticLowest,
      domesticLowestPriceKrw: domesticLowest,
      domesticSellerCount: domesticLowest == null ? 0 : 3,
      domesticUnresolved: false,
    });
  }

  it("국내 비교상품이 없으면 hasComparable이 false다", () => {
    expect(buildMarketComparison(EMPTY_CARD, contextWith(null)).hasComparable).toBe(false);
  });

  it("국내 비교상품이 있으면 hasComparable이 true다", () => {
    const comparison = buildMarketComparison(EMPTY_CARD, contextWith(116600));
    expect(comparison.hasComparable).toBe(true);
    expect(comparison.domestic.value).not.toBeNull();
  });

  it("게이트가 뷰의 첫 줄이다 — 호출부가 빠뜨릴 수 있는 자리 자체가 없다", () => {
    // "빈 칸 두 개짜리 카드"와 "카드 없음"은 다른 화면이다. 빈 칸은 정보가
    // 아니라 질문이라, 셀러는 조회가 고장났는지 자기가 뭘 안 했는지를 스스로
    // 추론해야 했다.
    //
    // MI-POLISH-2(CEO 지시, 2026-09-12) — 그 게이트가 호출부의
    // `{marketComparison.hasComparable && (…)}`에서 **뷰 안**으로 들어갔다.
    // 호출부 조건은 이 뷰를 한 번 더 쓰는 사람이 빠뜨릴 수 있고, 무엇보다
    // "빈 카드가 아니라 카드 없음"을 소스 배치로는 증명할 수 없다 — 실제 렌더가
    // 빈 문자열이라는 것은 mi-polish.test.ts가 DOM으로 확인한다.
    const viewAt = panel.indexOf("function MarketComparisonView");
    const bodyAt = panel.indexOf("return (", viewAt);
    const gateAt = panel.indexOf("if (!comparison.hasComparable) return null;", viewAt);
    expect(gateAt).toBeGreaterThan(viewAt);
    expect(gateAt).toBeLessThan(bodyAt);
    // 호출부에는 조건이 남아 있지 않다(두 곳이 각자 세면 언젠가 갈라진다).
    expect(panelCode).not.toContain("{marketComparison.hasComparable && (");
  });

  it("숨긴 사실은 판정 안에 남는다 — '판단하지 않았다'를 말하지 않고 지우지 않는다", () => {
    // 비교 근거가 없다는 것은 판정의 일부다. 본문에서 빠지면 셀러는 가격
    // 경쟁력까지 확인된 판정으로 읽는다.
    expect(NO_DOMESTIC_COMPARABLE_NOTE).toContain("가격 경쟁력은 판단하지 않았습니다");
    const detail = panel.slice(panel.indexOf("{showMarketDetail && ("));
    expect(detail).toContain("{!marketComparison.hasComparable && (");
    expect(detail).toContain("{NO_DOMESTIC_COMPARABLE_NOTE}");
    // 본문에는 없다 — 본문은 판단에 필요한 숫자이지 판정의 근거가 아니다.
    expect(bodyCode).not.toContain("NO_DOMESTIC_COMPARABLE_NOTE");
  });
});

describe("글로벌 시장 가격은 툴팁·상세에 산다 — 본문 카드가 아니다", () => {
  const CARD = buildGlobalMarketCard({
    observations: [
      { marketCode: "en-fr", marketCountry: "ES", currency: "EUR", priceAmount: 75, priceKrw: 116742, soldOut: false, productUrl: null, checkedAt: "2026-09-12T00:00:00Z" },
      { marketCode: "en-kr", marketCountry: "ES", currency: "KRW", priceAmount: 162000, priceKrw: 162000, soldOut: false, productUrl: null, checkedAt: "2026-09-12T00:00:00Z" },
    ],
  });

  it("본문 한 줄은 시장과 가격, 그 둘뿐이다", () => {
    expect(globalMarketSummaryLine(CARD)).toBe("🇫🇷 FR €75.00 · 🇰🇷 KR ₩162,000");
  });

  it("관측이 없으면 조용한 한 줄 하나다 — 경고 상자도 실패 로그도 없다", () => {
    expect(globalMarketSummaryLine(buildGlobalMarketCard({ observations: [] }))).toBeNull();
    expect(GLOBAL_MARKET_UNAVAILABLE_NOTE).toBe("글로벌 시장 가격을 확인할 수 없습니다.");
    const hint = panel.slice(panel.indexOf("function GlobalMarketHint"), panel.indexOf("function GlobalMarketCardView"));
    // 조회 실패를 판정의 실패처럼 그리지 않는다(노란 경고 = warning 계열 클래스).
    expect(hint).not.toMatch(/warning|error/);
    expect(hint).toContain("ⓘ {GLOBAL_MARKET_UNAVAILABLE_NOTE}");
  });

  it("본문에 시장별 목록(ul/행)이 없다 — 카드가 아니라 한 줄이다", () => {
    expect(bodyCode).not.toContain("<GlobalMarketRowView");
    expect(bodyCode).not.toContain("<GlobalMarketCardView");
    expect(bodyCode).toContain("<GlobalMarketHint");
    // 한 줄은 ① 원본 상품 안에 붙는다 — 같은 판매처의 사실이기 때문이다.
    expect(bodyCode).toContain("globalMarketSummaryLine(globalMarketCard)");
  });

  it("근거는 툴팁(title)이, 원자료는 펼침이 맡는다", () => {
    const hint = panel.slice(panel.indexOf("function GlobalMarketHint"), panel.indexOf("function GlobalMarketCardView"));
    expect(hint).toContain("title={card.note}");
    expect(hint).toContain("{open && <GlobalMarketCardView card={card} />}");
    // 기본은 접힘이다 — 펼침 상태가 렌더 기본값이 되면 카드가 되살아난다.
    expect(panel).toContain("const [showGlobalMarketDetail, setShowGlobalMarketDetail] = useState(false);");
  });

  it("글로벌 시장은 본문 읽는 순서에 속하지 않는다 — 제목에 번호가 없다", () => {
    expect(PRICE_SECTION_TITLE.SELLER_GLOBAL_MARKET).not.toMatch(/[①②③④⑤]/);
  });
});

describe("③ 수익성은 판정이지 계산서가 아니다", () => {
  const profit = body.slice(body.indexOf("{PRICE_SECTION_TITLE.PROFITABILITY}"), body.indexOf("{PRICE_SECTION_TITLE.DECISION_EVIDENCE}"));
  const profitCode = stripComments(profit);

  it("사슬은 요약 네 줄이고, 그 넷이 무엇인지는 price-hierarchy의 tier가 정한다", () => {
    // 화면이 key나 role을 세어 고르기 시작하면 값이 하나 늘 때마다 여기를
    // 또 고쳐야 한다(이 규칙은 UX 2.4부터 그대로다).
    expect(profitCode).toContain("<PriceChainView rows={priceChain} />");
    expect(panel).toContain('rows.filter((row) => row.tier === "SUMMARY")');
    const hierarchy = readSourceAt(new URL("../price-hierarchy.ts", import.meta.url));
    const summaryRoles = [...hierarchy.matchAll(/^\s{2}(SOURCE|CONVERT|ADD|TOTAL|PLAN|RESULT): "(SUMMARY|DETAIL)"/gm)];
    expect(summaryRoles.filter(([, , tier]) => tier === "SUMMARY").map(([, role]) => role)).toEqual([
      "TOTAL",
      "PLAN",
      "RESULT",
    ]);
  });

  it("배지는 하나이고, 그 옆 숫자는 '얼마에 팔지' 하나뿐이다", () => {
    // 요약 넷 + 배지 하나 + 추천가 하나. 이 자리에 숫자가 더 붙기 시작하면
    // 결론이어야 할 블록이 다시 계산서가 된다.
    expect((profitCode.match(/profitVerdict\.(icon|note|title)/g) ?? []).length).toBe(2);
    const priceReads = profitCode.match(/\.toLocaleString\(\)/g) ?? [];
    expect(priceReads.length).toBeLessThanOrEqual(2); // 추천가(있을 때) + 원가 역산 제안가(추천 없을 때) — 동시에 뜨지 않는다
    expect(profitCode).toContain("recommendation?.recommendedPrice != null");
    expect(profitCode).toContain("{!recommendation && cost && (");
  });

  it("계산 사슬이 본문에서 다시 펼쳐지지 않는다", () => {
    // 상세 계산(PriceCalculationDetail)은 접힘 안에만 있다. 본문이 환율·
    // 국제배송비·수수료율·목표 마진을 다시 말하기 시작하면 MI는 또 가격 계산
    // 설명 화면이 된다 — 이번 지시가 되돌리라고 한 화면 그대로다.
    for (const term of ["환율", "국제배송비", "수수료율", "목표 마진", "예상 수수료"]) {
      expect(bodyCode, `${term}이(가) 본문에 있다`).not.toContain(term);
    }
    const slotAt = profit.indexOf("{priceCalculationDetail}");
    const gateAt = profit.indexOf("{showPriceDetail && (");
    expect(gateAt).toBeGreaterThan(-1);
    expect(slotAt).toBeGreaterThan(gateAt);
    expect(panel).toContain("const [showPriceDetail, setShowPriceDetail] = useState(false);");
  });

  it("ⓘ 가격 계산 기준의 툴팁은 공식의 모양만 말한다 — 숫자를 적지 않는다", () => {
    expect(PRICE_BASIS_TOOLTIP).toBe("상품가격 + 해외배송비 + 설정 가격정책 → 권장 판매가격");
    expect(PRICE_BASIS_TOOLTIP).not.toMatch(/\d/);
    expect(profit).toContain("title={PRICE_BASIS_TOOLTIP}");
    expect(profit).toContain("ⓘ 가격 계산 기준 {caret(showPriceDetail)}");
  });
});

describe("본문은 짧아졌고, 다음 추가는 툴팁·상세로 내려앉는다", () => {
  /**
   * MI-SIMPLIFY-1 실측(2026-09-12, eac7260 대비) — stripComments로 주석·빈 줄을
   * 걷어낸 본문 코드 줄 수:
   *
   *   before  169줄   ① 카드 + ② 글로벌 카드 + ③ 비교 카드 + ④ 사슬 + dl 한 칸 + 토글
   *   after   144줄   ① 카드(+ⓘ 한 줄) + ②(비교상품 있을 때만) + ③ 사슬 + 배지 + ⓘ
   *
   * 숫자 자체가 목적은 아니다. 이 상한이 있으면 다음 기능이 본문에 카드를
   * 하나 더 세울 때 바로 걸리고, 그때 고를 수 있는 길이 "툴팁이냐 상세냐"로
   * 좁혀진다 — 그게 이번 지시가 코드에 남기라고 한 규칙이다.
   */
  it("본문 코드 줄 수가 MI-SIMPLIFY-1 이전(169줄)보다 줄어든 채로 남는다", () => {
    // MI-POLISH-2(CEO 지시, 2026-09-12) — 상한이 한 번 더 내려간다: 144 → 116.
    // 축 세 줄 · ④ 판단 근거 · 👉 안내 문장 · cta.hint · 기준 문장들이 전부
    // 툴팁과 「왜 이렇게 판단했나요?」로 내려갔다(mi-polish.test.ts가 그 이동을
    // 항목별로 고정한다). 여기 남는 것은 판정 · ① · ② · ③ · 바닥 한 줄뿐이다.
    const lines = bodyCode.split("\n").filter((line) => line.trim()).length;
    expect(lines).toBeLessThan(169);
    expect(lines).toBeLessThanOrEqual(118);
  });

  it("본문에 남는 것은 판정 · ① · ② · ③ 넷뿐이다", () => {
    // 판단 근거(별점·레이더)와 시장 신호·전략 가이드는 여전히 접힘 안이거나
    // ④ 판단 근거 안이다. 새 블록이 본문에 서면 여기서 먼저 걸린다.
    const blocks = ["<OriginalPriceView", "<GlobalMarketHint", "<MarketComparisonView", "<PriceChainView"];
    for (const block of blocks) expect(bodyCode).toContain(block);
    expect(bodyCode).not.toContain("<MiRadar ");
    expect(bodyCode).not.toContain("<MiRadarSummary");
    expect(bodyCode).not.toContain("marketSignals.signals.map");
    expect(bodyCode).not.toContain("sellingGuidance.map");
  });

  it("상세 계산은 MI 안에서 다시 마운트되지 않는다 — 슬롯으로만 받는다", () => {
    // 이 패널이 PriceCalculationDetail을 직접 그리면 product와 setter 넷이
    // 들어오고, 그때부터 "가격이 바뀌었으니 다시 분석하자"는 배선이 생긴다.
    expect(panelCode).not.toContain("<PriceCalculationDetail");
    expect(panelCode).not.toContain("computePriceBreakdown");
    expect(panelCode).not.toContain("/api/price-intelligence");
  });
});
