import { describe, expect, it } from "vitest";
import { buildGlobalMarketCard, globalMarketSummaryLine, GLOBAL_MARKET_UNAVAILABLE_NOTE } from "../global-market";
import { buildMarketComparison } from "../market-comparison";
import { miMarketCaseVerdict, NO_DOMESTIC_COMPARABLE_NOTE, PRICE_BASIS_TOOLTIP } from "../mi-market-case";
import { buildMarketContext, PRICE_SECTION_TITLE } from "../price-hierarchy";
import { miBodySource, readSourceAt, stripComments } from "./source-text";

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

/**
 * 셀러가 누르지 않고 보는 **본문**.
 *
 * MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 정의가 source-text.ts로 옮겨가며
 * 넓어졌다. 예전에는 판정 카드 **안쪽**만 잘라서, 카드 아래에 접힘 없이 서
 * 있던 다섯 덩어리(재조회 · 기회 · 국내 비교상품 · 동일상품 근거 · 안내 문단)를
 * 이 파일이 구조적으로 볼 수 없었다. 이제 FULL 렌더 전체에서 「왜 이렇게
 * 판단했나요?」 블록만 들어낸 나머지가 본문이다 — 아래 금지 목록이 전부 그
 * 넓어진 구간에 적용된다.
 */
const body = miBodySource(panel);
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

describe("🇰🇷 국내 시장은 비교 대상 유무를 한 곳에서만 판정한다", () => {
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

  it("숨기는 조건이 호출부에 남아 있지 않다", () => {
    // MI-POLISH-2(CEO 지시, 2026-09-12) — 그 조건이 호출부의
    // `{marketComparison.hasComparable && (…)}`에서 **뷰 안**으로 들어갔다.
    // 호출부에 두면 이 뷰를 한 번 더 쓰는 사람이 다른 결과를 만들 수 있다.
    //
    // MI-MARKET-EVIDENCE-1(CEO 지시 ③, 2026-09-12) — 조건이 고르는 **결과**가
    // 바뀌었다. 이 블록은 이제 셀러가 읽는 순서(원본 → 국내 → 해외 → 수익성)의
    // 가운데 칸이라 사라지지 않고, 근거가 없으면 정직한 빈 상태 칩 하나를
    // 세운다(실제 렌더는 mi-polish.test.ts가 DOM으로 확인한다). 판정을 한
    // 곳에서만 한다는 규칙은 그대로다.
    expect(panelCode).not.toContain("{marketComparison.hasComparable && (");
  });

  it("숨긴 사실은 판정 안에 남는다 — '판단하지 않았다'를 말하지 않고 지우지 않는다", () => {
    // 비교 근거가 없다는 것은 판정의 일부다. 본문에서 빠지면 셀러는 가격
    // 경쟁력까지 확인된 판정으로 읽는다.
    expect(NO_DOMESTIC_COMPARABLE_NOTE).toContain("가격 경쟁력은 판단하지 않았습니다");
    const detail = panel.slice(panel.indexOf("{showMarketDetail && ("));
    // MI-UX-FINAL-4(CEO 지시, 2026-09-13) — 그 사실은 이제 되물음 **네 줄의 한
    // 줄**이 직접 말한다(mi-verdict-copy.ts의 domesticLine). 별도 문단으로 한
    // 번 더 적던 것을 없앴을 뿐, 말하지 않게 된 것은 없다.
    expect(detail).toContain("verdictExplanation");
    // 화면 어디에도 이 문단은 더 이상 없다 — 같은 사실을 세 번 적던 것을
    // 두 층(본문 빈 상태 칩 · 되물음 둘째 줄)으로 줄였다.
    expect(stripComments(panel)).not.toContain("{NO_DOMESTIC_COMPARABLE_NOTE}");
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
    // MI-UX-FINAL-REVIEW — 주어가 붙었다. 관측을 만드는 유일한 장치가 Shopify
    // Markets probe라(shopify-market-probe.ts의 extractShopifyHandle), 이 줄이
    // 뜨는 대부분은 조회 실패가 아니라 "이 사이트에는 시장별 페이지가 없다"이다.
    expect(GLOBAL_MARKET_UNAVAILABLE_NOTE).toBe("현재 사이트에서는 글로벌 시장 가격을 확인할 수 없습니다.");
    const hint = panel.slice(panel.indexOf("function GlobalMarketHint"), panel.indexOf("function GlobalMarketCardView"));
    // 조회 실패를 판정의 실패처럼 그리지 않는다(노란 경고 = warning 계열 클래스).
    expect(hint).not.toMatch(/warning|error/);
    // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 그 한 줄이 **본문에서 팝오버로**
    // 옮겨갔다. 관측이 없을 때 본문의 ⓘ 이름을 문장으로 바꿔 치우던 분기가
    // 바로 "대표님 화면에 ⓘ 글로벌 시장 가격이 없던" 원인이라, 이제 두 상태가
    // 같은 버튼을 갖고 문장은 팝오버 안에만 있다.
    expect(hint).toContain("{GLOBAL_MARKET_UNAVAILABLE_NOTE}");
    expect(hint).toContain("ⓘ {GLOBAL_MARKET_HINT_LABEL}");
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
    // MI-UX-FINAL-REVIEW — 툴팁이 시장별 가격까지 함께 맡는다. 본문 한 줄에
    // 남는 것은 이름 하나(ⓘ 글로벌 시장 가격)뿐이고 값은 마우스를 올리거나
    // 펼쳐야 나온다 — 카드가 한 줄이 됐어도 네 개의 가격이 본문에 늘어서
    // 있으면 층만 내려갔지 표면은 그대로다.
    // MI-FINAL-UX-3 — 관측이 없을 때도 같은 자리가 근거를 들고 있다(그 사실 한 줄).
    expect(hint).toContain("title={summaryLine ? `${summaryLine} · ${card.note}` : GLOBAL_MARKET_UNAVAILABLE_NOTE}");
    expect(hint).toContain("ⓘ {GLOBAL_MARKET_HINT_LABEL}");
    expect(hint).not.toContain(">{summaryLine}<");
    // MI-FINAL-UX-3 — 펼침은 본문 흐름 밖(absolute 팝오버)에 뜬다. 카드였을
    // 때는 열 때마다 아래 블록이 통째로 밀렸다.
    expect(hint).toContain("<GlobalMarketCardView card={card} />");
    expect(hint).toContain("absolute left-0 top-full");
    // 기본은 접힘이다 — 펼침 상태가 렌더 기본값이 되면 카드가 되살아난다.
    expect(panel).toContain("const [showGlobalMarketDetail, setShowGlobalMarketDetail] = useState(false);");
  });

  it("글로벌 시장은 본문 읽는 순서에 속하지 않는다 — 제목에 번호가 없다", () => {
    expect(PRICE_SECTION_TITLE.SELLER_GLOBAL_MARKET).not.toMatch(/[①②③④⑤]/);
  });
});

describe("③ 수익성은 판정이지 계산서가 아니다", () => {
  // MI-POLISH-2에서 ④ 판단 근거가 접힘 안으로 내려간 뒤로 본문에는 그 제목이
  // 없다. 그래서 이 블록의 끝은 본문의 바닥 한 줄(되물음)이다.
  const profit = body.slice(body.indexOf("{PRICE_SECTION_TITLE.PROFITABILITY}"), body.indexOf("{caret(showMarketDetail)} 왜 이렇게 판단했나요?"));
  const profitCode = stripComments(profit);

  it("사슬이 무엇을 요약에 세우는지는 화면이 아니라 price-hierarchy가 정한다", () => {
    // 화면이 key나 role을 세어 고르기 시작하면 값이 하나 늘 때마다 여기를
    // 또 고쳐야 한다(이 규칙은 UX 2.4부터 그대로다).
    expect(profitCode).toContain("<PriceChainView rows={priceChain} />");
    expect(panel).toContain('rows.filter((row) => row.tier === "SUMMARY")');
    // MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 요약은 셋이고, 셋 다 [ⓘ 가격 계산
    // 기준]이 그리는 값이다. 무엇이 요약인지는 buildPriceChain이 줄마다 직접
    // 지정한다(같은 role에 요약 줄과 상세 줄이 함께 있기 때문 — 권장 판매가 vs
    // 내 판매가격, 예상 이익 vs 예상 마진). 그 계약은 price-hierarchy.test.ts가
    // 실제 결과로 고정한다.
    const hierarchy = readSourceAt(new URL("../price-hierarchy.ts", import.meta.url));
    expect(hierarchy).toContain("profitability: ProfitabilityNumbers | null;");
    // 서버 값을 폴백으로 되돌리는 경로 자체가 없다 — 넘길 인자가 없다.
    expect(hierarchy).not.toContain("landedCostKrw: number | null;");
    expect(hierarchy).not.toContain("expectedProfitKrw: number | null;");
  });

  it("수익성에 서는 것은 배지 하나와 요약 세 줄뿐이다 — 값을 직접 포맷하지 않는다", () => {
    expect((profitCode.match(/profitVerdict\.(icon|note|title)/g) ?? []).length).toBe(2);
    // MI-FINAL-UX-3 — 여기 있던 🏷 두 갈래(최종 추천 판매가 / 추천 판매가)를
    // 뺐다. 바로 아래 「권장 판매가」 줄이 상세 계산과 같은 값으로 그 자리를
    // 대신한다 — 한 화면에 "이 가격에 팔아라"가 둘이면 셀러는 다시 고른다.
    expect(profitCode.match(/\.toLocaleString\(\)/g) ?? []).toHaveLength(0);
    expect(profitCode).not.toContain("recommendation?.recommendedPrice != null");
    expect(profitCode).not.toContain("{!recommendation && cost && (");
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
    /**
     * MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — 이 숫자로 "화면이 짧아졌다"를
     * 주장하지 않는다. 앞선 두 번(169 → 144 → 116)이 전부 줄어든 채로 통과했는데
     * 프로덕션 화면은 그대로 길었다 — 세던 구간이 화면의 일부였기 때문이다.
     * 화면이 실제로 무엇을 보여주는지는 mi-ux-final.test.ts가 패널을 통째로
     * 렌더해서 확인한다.
     *
     * 그래도 상한을 남기는 이유는 하나다: 다음 기능이 본문에 줄을 세우려 할 때
     * 여기서 먼저 걸리고, 그때 고를 수 있는 길이 "툴팁이냐 상세냐"로 좁혀진다.
     * 구간이 FULL 렌더 전체로 넓어졌으므로(miBodySource) 이전 숫자와 직접
     * 비교할 수 있는 값이 아니다.
     */
    expect(lines).toBeLessThanOrEqual(155);
  });

  it("본문에 남는 것은 판정 · 원본 · 국내 · 해외 · 수익성뿐이다", () => {
    // 판단 근거(별점·레이더)와 시장 신호·전략 가이드는 여전히 접힘 안이거나
    // 판단 근거 안이다. 새 블록이 본문에 서면 여기서 먼저 걸린다.
    // MI-MARKET-EVIDENCE-1 — 🌎 해외 시장이 본문 블록으로 들어왔다.
    const blocks = [
      "<OriginalPriceView",
      "<GlobalMarketHint",
      "<MarketComparisonView",
      "<OverseasMarketEvidenceView",
      "<PriceChainView",
    ];
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
