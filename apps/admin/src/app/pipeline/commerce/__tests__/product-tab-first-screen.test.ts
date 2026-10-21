import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLOBAL_MARKET_HINT_LABEL, GLOBAL_MARKET_UNAVAILABLE_NOTE } from "../global-market";
import {
  buildOverseasMarketEvidence,
  DOMESTIC_MARKET_DRILL_DOWN,
  OVERSEAS_MARKET_DRILL_DOWN,
} from "../market-evidence";
import { isDefaultVisibleTier, overseasMatchDisplay } from "../match-display";
import { buildMiVerdictExplanation } from "../mi-verdict-copy";
import { PRICE_MEANING_LABEL, PRICE_SECTION_TITLE } from "../price-hierarchy";
import {
  headingsInOrder,
  overseasResults,
  overseasResultsMixedTier,
  productTabElement,
  productionData,
  regionsOf,
  visibleText,
  withDomesticComparable,
  withMixedTierDomestic,
  PROFIT,
  type OverseasSearchResult,
  type TabOptions,
} from "./product-tab-composition";

/**
 * MI-MARKET-EVIDENCE-1(CEO 지시, 2026-09-12) — **상품정보 탭 전체**의 첫 화면.
 *
 * 이 파일이 보는 것은 MiPanelView 하나가 아니라 CommerceWorkspace가 상품정보
 * 탭에서 실제로 조립하는 트리다(product-tab-composition.ts). 그래야 "MI는
 * 짧은데 화면은 길다"를 구분해서 말할 수 있다 — 지난 세 번의 시도가 전부
 * 여기서 갈렸다.
 *
 * ── 이번 지시로 바뀐 것 ──────────────────────────────────────────────────
 * 앞선 네 번은 전부 "더 짧게"였다. 그 결과 국내/해외 가격이 MI 밖으로 밀려났고,
 * 판정만 남은 화면은 근거 없이 내려온 숫자처럼 읽혔다. 이제 이 파일이 고정하는
 * 것은 **짧음**이 아니라 셀러가 묻는 순서다:
 *
 *   원본 €50 → 🇰🇷 한국에서 얼마에 팔리나 → 🌎 해외에서는 → 💰 얼마에 팔면 되나
 *
 * 규칙은 그대로다: **아무것도 누르지 않은 상태의 렌더 결과**만 근거로 쓴다.
 * 소스 줄 수도, 잘라낸 구간도, 자식 하나만 떼어낸 렌더도 근거가 아니다.
 */

function render(options: TabOptions = {}): string {
  return renderToStaticMarkup(productTabElement(options));
}

/** ② 시장 판단이 현재 단계 — MI가 FULL로 서는 화면(CEO 스크린샷과 같은 상태). */
const MARKET_STAGE: TabOptions = { marketDone: false };
/** ③ 등록 준비에서 [가격 판단 상세보기]로 MI를 펼쳐 둔 화면. MI는 같은 FULL이다. */
const PREPARE_STAGE_MI_OPEN: TabOptions = { marketDetailOpen: true };

/**
 * 해외 요약은 화면이 만들지 않는다 — 해외 가격비교 패널이 자기 조회 결과로
 * 만들어 올려보낸 값이다. 여기서도 그 패널이 쓰는 함수를 같은 규칙(기본 노출
 * 등급만 · 현재가로 검증된 건만 숫자)으로 불러서 넘긴다. 손으로 요약 문자열을
 * 적으면 화면이 그 요약을 어떻게 다루는지 검사하는 의미가 사라진다.
 */
function overseasEvidenceFrom(results: OverseasSearchResult[]) {
  return buildOverseasMarketEvidence({
    candidates: results.flatMap((r) =>
      r.candidates
        .map((c) => ({
          shopId: r.shopId,
          shopCountry: r.shopCountry,
          tier: overseasMatchDisplay(c.productMatchTruth!).tier,
          price: c.priceStatus === "VERIFIED_CURRENT" ? c.price : null,
        }))
        .filter((c) => isDefaultVisibleTier(c.tier)),
    ),
  });
}

/** 국내·해외가 전부 확인된 화면 — CEO 지시문의 목표 첫 화면 그대로다. */
const WITH_BOTH_MARKETS: TabOptions = {
  ...MARKET_STAGE,
  data: withDomesticComparable(),
  overseasMarketEvidence: overseasEvidenceFrom(overseasResults()),
};

describe("상품정보 탭 — 아무것도 누르지 않았을 때의 첫 화면", () => {
  const html = render(MARKET_STAGE);
  const headings = headingsInOrder(html);
  /** 판단 카드 **안쪽**만. 아래 단계 본문의 글자가 섞이면 무엇이 MI인지 알 수 없다. */
  const miText = visibleText(regionsOf(html).mi);
  const miHtml = regionsOf(html).mi;

  /**
   * ── 이 테스트가 실제로 증명하는 것 ──────────────────────────────────────
   * 셀러가 읽는 제목이 **무엇이 몇 개 어떤 순서로** 서는가.
   */
  it("첫 화면의 최상위 제목은 순서까지 고정된다", () => {
    expect(headings).toEqual([
      // ── 여기부터 MI(판단 카드) ──
      "Market Intelligence",
      "원본 상품",
      "ⓘ 글로벌 시장 가격",
      /**
       * 🔴 WU-141-R3 — 「🇰🇷 국내 시장」·「🌎 해외 시장」이 **여기 없다.**
       *    둘은 결론 영역 「📊 시장 판매 판단」(`MarketPriceComparison` · 격자 «밖»
       *    최상단 · WU-140-R1)으로 올라갔다 ⟹ 셀러는 그 둘을 **더 먼저** 읽는다.
       *    🔴 이 하니스는 격자 왼쪽 기둥 + ActionCenter 만 조립하므로 그 영역이
       *       **트리에 없다**(CommerceWorkspace 가 주인이다).
       */
      "수익성",
      "ⓘ 가격 계산 기준",
      "왜 이렇게 판단했나요?",
      // ── 여기부터는 MI가 아니다(StageBody) ──
      "지금 단계 · 2. 시장 판단",
      "🇰🇷 한국 시장 · 국내 비교상품 (베타)",
      "🌎 글로벌 시장 · 해외 판매처 가격 (베타)",
      "💰 판매가격 확정",
      "이미지",
      "Source Data",
      "Backlog",
      // ── 오른쪽 기둥(ActionCenter) ──
      "판매 판단",
      "등록 전 확인",
      "커머스 등록",
    ]);
  });

  /**
   * MI가 세우는 제목은 여덟이다. 데이터가 있든 없든 같은 여덟이라는 것이
   * 이번 지시의 핵심이다 — 블록이 조건부로 사라지면 셀러가 읽는 순서의 한 칸이
   * 비고, 그 순간 판정은 다시 근거 없이 내려온 숫자가 된다.
   */
  it("MI의 제목 여섯은 데이터 유무와 무관하게 같은 순서로 선다", () => {
    const expected = [
      "Market Intelligence",
      "원본 상품",
      "ⓘ 글로벌 시장 가격",
      /**
       * 🔴 WU-141-R3 — 「🇰🇷 국내 시장」·「🌎 해외 시장」이 **여기 없다.**
       *    둘은 결론 영역 「📊 시장 판매 판단」(`MarketPriceComparison` · 격자 «밖»
       *    최상단 · WU-140-R1)으로 올라갔다 ⟹ 셀러는 그 둘을 **더 먼저** 읽는다.
       *    🔴 이 하니스는 격자 왼쪽 기둥 + ActionCenter 만 조립하므로 그 영역이
       *       **트리에 없다**(CommerceWorkspace 가 주인이다).
       */
      "수익성",
      "ⓘ 가격 계산 기준",
      "왜 이렇게 판단했나요?",
    ];
    expect(headingsInOrder(miHtml)).toEqual(expected);
    expect(headingsInOrder(regionsOf(render(WITH_BOTH_MARKETS)).mi)).toEqual(expected);
  });

  /** 첫 번째 접힘 토글 앞에 서는 것 — 판정과 원본 가격뿐이다. */
  it("첫 접힘 토글 앞에 서는 것은 판정 · 원본 상품뿐이다", () => {
    const miHeadings = headingsInOrder(miHtml);
    expect(miHeadings.slice(0, miHeadings.indexOf("ⓘ 글로벌 시장 가격"))).toEqual([
      "Market Intelligence",
      "원본 상품",
    ]);
    expect(miText).toContain("🇰🇷 대한민국 시장 기준");
    expect(miText).toContain("🟡 조건부 판매");
    expect(miText).toContain("€50.00");
  });

  /**
   * ── 지시 ① ──────────────────────────────────────────────────────────────
   * ⓘ는 관측이 0건이어도 사라지지 않는다. 이 자리는 **원본 €50의 근거**(같은
   * 판매처의 다른 시장 가격)이고, 아래 🌎 해외 시장(다른 판매처들의 가격)과는
   * 끝까지 다른 사실이다.
   */
  it("관측이 0건이어도 ⓘ 글로벌 시장 가격이 그대로 선다", () => {
    expect(productionData().sellerGlobalMarkets).toEqual([]);
    expect(miText).toContain(`ⓘ ${GLOBAL_MARKET_HINT_LABEL}`);
    // 팝오버가 닫혀 있으므로 그 안의 문장은 본문에 없다(툴팁은 태그 속성이라
    // visibleText에 잡히지 않는다 — 화면 높이를 차지하지 않는다는 뜻이다).
    expect(miText).not.toContain(GLOBAL_MARKET_UNAVAILABLE_NOTE);
  });

  /**
   * ── 지시 ③ ──────────────────────────────────────────────────────────────
   * 비교상품이 0건이면 **숫자를 지어내지 않는다**. 블록은 그대로 서고, 없다는
   * 사실만 말한다(MI-SIMPLIFY-1에서는 블록째 사라졌다 — 그때는 두 칸짜리 빈
   * 카드였기 때문이고, 지금은 셀러가 읽는 순서의 가운데 칸이라 다르다).
   */
  /**
   * 🔴🔴 WU-141-R3 — **「숫자를 지어내지 않는다」의 owner 가 결론 영역으로 갔다**(분류 C).
   *
   * 🟢 규칙은 **살아 있고 더 세졌다** — 결론 영역은 ⒜ 시장 블록이 빈 **이유** 를 말하고
   *    (`marketEmptyNote`) ⒝ 시장이 확정되지 않은 후보 수를 따로 말하고
   *    (`marketUnresolvedNote`) ⒞ 1건을 「가격대/평균」이라 부르지 않는다
   *    (`PRICE_GUIDE_SINGLE_NOTE` · WU-139 계약 B-2). 🔴 그 셋 전부 이 하니스 **밖** 이다.
   * 🔴 여기서 지킬 수 있는 것은 **「판정 카드가 같은 사실을 두 번 적지 않는다」** 다.
   */
  it("판정 카드는 시장 빈 상태를 다시 적지 않는다 — 거짓 숫자도 없다", () => {
    expect(miText).not.toContain(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(miText).not.toContain(PRICE_SECTION_TITLE.OVERSEAS_MARKET);
    expect(miText).not.toContain("⚪ 검색 데이터 없음");
    // 🟢 없는 값을 대신할 숫자를 만들지 않는다 — 개수도, 범위 기호도 없다(불변).
    expect(miText).not.toContain("동일상품 기준");
    expect(miText).not.toContain("비교 판매처 0곳");
    expect(miText).not.toContain("~");
    /** 🔴 드릴다운 둘도 결론 영역의 몫이다 — 카드에 되돌아오면 FAIL. */
    expect(miText).not.toContain(DOMESTIC_MARKET_DRILL_DOWN);
    expect(miText).not.toContain(OVERSEAS_MARKET_DRILL_DOWN);
  });

  /**
   * ── 지시 ②(등급 없는 개수 금지) ─────────────────────────────────────────
   * 개수는 언제나 등급과 함께 나간다. 셀러가 묻는 것은 "3곳인가"가 아니라
   * "이 3곳을 왜 믿을 수 있지?"다.
   */
  /**
   * 🔴🔴 WU-141-R3 — **「개수는 등급과 함께 나간다」의 owner 가 바뀌었다**(분류 C).
   *
   * 🟢 문자열 규칙 자체는 `market-evidence.test.ts` 가 **그 함수들을 직접 불러** 계속
   *    본다(`tierCountsText` · `mixedNote` · `figure`). 🟢 결론 영역의 어휘는
   *    `wu-136-market-judgement-render` · `wu-140-market-first` 가 본다.
   * 🔴 이 파일에서 남는 명제는 **「판정 카드가 그 주장을 하지 않는다」** 하나다 —
   *    카드가 등급·개수·대표가를 또 말하면 결론 영역과 **어긋날 수 있는 두 번째 주장** 이 된다.
   */
  it("판정 카드는 대표 숫자·개수·등급을 주장하지 않는다", () => {
    const text = visibleText(regionsOf(render(WITH_BOTH_MARKETS)).mi);
    expect(text).not.toContain("₩116,600");
    expect(text).not.toContain("€45.00 ~ €52.00");
    expect(text).not.toContain("판매처 3곳 · 3개 국가");
    expect(text).not.toContain("🟢 동일상품 기준");
    /**
     * 🟢 **근거의 두께는 남는다** — 「비교 판매처 3곳」은 요약 카드의 「비교 근거」 줄이고
     *    전략 Gate ① 「MI 판단」에 속한다. 🔴 금액이 아니라 **몇 곳을 봤는가** 다.
     *    (이 구분을 놓쳐 1차에 `mi-ux-final` 이 FAIL 했고 그 계약이 나를 잡았다.)
     */
    expect(text).toContain("비교 판매처 3곳");
  });

  /**
   * ── CPO 추가 지시(2026-09-12) — 등급이 섞이면 하나로 접지 않는다 ────────────
   * 🟢 1곳 + ⚪ 2곳을 "🟢 동일상품 기준"으로 적으면 추정 두 곳이 확정으로
   * 포장된다. 요약만 읽고도 "전부 확정은 아니다"가 보여야 한다.
   */
  /**
   * 🔴🔴 WU-141-R3 — 등급 혼재 보호는 **결론 영역에서 «구조적으로» 성립한다**(분류 C).
   *
   * 🟢 「📊 시장 판매 판단」에 들어오는 후보는 `selectMiSameCandidates` 가 **tier SAME
   *    만** 통과시킨다 ⟹ 그 영역에서는 **등급이 섞일 수 없다.** 문구로 막던 것이
   *    **입력 게이트로** 막히는 쪽으로 올라간 것이고, 그게 더 강하다.
   * 🔴 그래서 이 파일은 **「카드가 혼재 상태를 강한 등급으로 접지 않는다」** 만 본다 —
   *    카드에 그 어휘가 아예 없으므로 **거짓 주장을 할 수 없다.**
   * 🟢 `tierCountsText`/`mixedNote` 의 문자열 규칙은 `market-evidence.test.ts` 가 유지한다.
   */
  it("판정 카드는 혼재 등급을 강한 등급 하나로 접지 않는다", () => {
    const mixed = render({
      ...MARKET_STAGE,
      data: withMixedTierDomestic(),
      overseasMarketEvidence: overseasEvidenceFrom(overseasResultsMixedTier()),
    });
    const text = visibleText(regionsOf(mixed).mi);
    // 어느 블록도 "🟢 동일상품 기준"이라고 말하지 않는다(불변).
    expect(text).not.toContain("🟢 동일상품 기준");
    /** 🔴 분포 문장도 카드의 몫이 아니다 — 같은 사실의 두 번째 자리를 만들지 않는다. */
    expect(text).not.toContain("🟢 동일상품 1 · ⚪ 비교상품 2");
    expect(text).not.toContain("🟢 동일상품 1 · 🟡 동일상품 추정 2");
    expect(text).not.toContain("등급이 섞여 있습니다");
  });

  /**
   * ── 같은 시장 사실이 한 화면에 두 번 서지 않는다 ─────────────────────────
   * 요약은 MI에, 원자료는 아래 패널에 한 벌뿐이다. 패널이 펼쳐진 채로 있으면
   * 같은 가격이 두 곳에서 뜨고, 그게 "짧게 만들면 근거가 사라지고 근거를
   * 되살리면 화면이 길어진다"를 반복하게 만든 구조다.
   */
  /**
   * 🔴🔴 WU-030(CPO 승인, 2026-10-16) — **이 계약이 «1 → 2» 로 명시적으로 갱신됐다.**
   *
   * 이전 규칙은 「대표 가격은 화면에 한 번만」이었고 그 자리는 🇰🇷/🌎 시장 요약이었다.
   * CPO 가 Production 화면 검토에서 「결론이 상단에 있기는 하나 **서로 떨어져 있어**
   * 셀러가 읽어 내려가며 조합해야 한다」를 결함으로 확정하고, **상품 판단 요약 블록**
   * 추가와 이 화면 계약 갱신을 **명시적으로 승인** 했다.
   *
   * 🟢 그래서 같은 숫자가 서는 자리는 이제 **둘이고 역할이 다르다**:
   * ```
   * 상품 판단 요약  → **결론**  (먼저 읽는다 · 네 질문에 한 덩어리로 답한다)
   * 🇰🇷/🌎 시장 요약 → **근거**  (그 숫자가 무엇에서 나왔는지)
   * ```
   * 🔴 **셋은 여전히 금지다** — 되물음이나 상세가 같은 숫자를 또 적으면 이 단언이
   *    다시 깨진다. 규칙이 사라진 게 아니라 상한이 1에서 2로 바뀐 것뿐이다.
   * 🔴 그리고 숫자를 **다시 계산해서** 적는 것은 여전히 금지다 — 요약은
   *    `market-evidence` 가 만든 `figure` 문자열을 그대로 옮긴다.
   */
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 WU-141-R3 — **상한이 「2」에서 「0」이 됐다. 그런데 규칙은 「1」이다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 이 계약의 숫자가 바뀌는 세 번째 자리라 **이력을 전부 남긴다**:
   * ```
   * WU-030 이전  1  — 🇰🇷/🌎 시장 요약(근거) 하나
   * WU-030       2  — + 상품 판단 요약(결론)                     ← CPO 승인
   * WU-141-R3    0  — 🔴 **이 트리에서 0** (owner 가 트리 밖으로 갔다)
   * ```
   * 🟢 **전체 화면 기준으로는 「1」로 돌아왔다** — 가격 숫자의 집은
   *    「📊 시장 판매 판단」(`MarketPriceComparison`) **하나** 이고, 그 영역은
   *    `CommerceWorkspace` 가 **격자 밖** 에서 렌더한다(이 하니스는 격자 왼쪽 기둥 +
   *    ActionCenter 만 조립한다).
   *
   * 🔴🔴 **「0」을 「검사하지 않는다」로 만들지 않는다.** 「정확히 한 번」은 두 파일이
   *    나눠 가진다 — 여기서 **0**(두 번째 자리가 없다), `wu-141-r3-price-owner.test.ts`
   *    에서 **1**(owner 를 직접 렌더해 센다). 🔴 둘 중 하나만 보면 상한이 증명되지 않는다.
   */
  it("판정 카드·단계 본문에는 시장 가격 숫자가 0이고 아래 패널은 접혀 있다", () => {
    const rendered = render(WITH_BOTH_MARKETS);
    const text = visibleText(rendered);
    expect((text.match(/€45\.00 ~ €52\.00/g) ?? []).length).toBe(0);
    expect((text.match(/₩116,600/g) ?? []).length).toBe(0);
    // 원자료 **표**가 첫 화면에 한 개도 없다(접혀 있다는 뜻이다). 접힘 요약
    // 한 줄이 같은 낱말들을 쓰므로 글자가 아니라 표 자체를 센다.
    const stage = regionsOf(rendered).stage;
    expect(stage).not.toContain("<table");
    expect(stage).not.toContain("<th");
  });

  /**
   * ── 지시 ③(수익성) ─────────────────────────────────────────────────────
   * 수익성은 요약 셋과 판정 한 줄이다. 계산 입력은 접힘 안에만 있다.
   */
  it("수익성은 판정 한 줄 + 숫자 셋이고 계산 입력은 본문에 없다", () => {
    expect(miText).toContain(PRICE_SECTION_TITLE.PROFITABILITY);
    expect(miText).toContain("동일상품 가격 비교 근거 부족");
    for (const [label, value] of [
      [PRICE_MEANING_LABEL.LANDED_COST, PROFIT.landedCostKrw],
      [PRICE_MEANING_LABEL.RECOMMENDED_PRICE, PROFIT.recommendedPriceKrw],
      [PRICE_MEANING_LABEL.EXPECTED_PROFIT, PROFIT.expectedProfitKrw],
    ] as const) {
      expect(miText, `${label}이(가) 없다`).toContain(label);
      expect(miText, `${label} 값이 상세 계산과 다르다`).toContain(`₩${value.toLocaleString("ko-KR")}`);
    }
    // 계산의 **입력**은 한 글자도 판단 카드에 없다 — 전부 [ⓘ 가격 계산 기준] 안이다.
    for (const banned of ["환율", "국제배송비", "예상 수수료", "목표 마진", "원본 가격", "국내 배송원가"]) {
      expect(miText, `${banned}이(가) 첫 화면에 있다`).not.toContain(banned);
    }
    // 확정 전이라 값이 없는 두 줄은 애초에 자리를 얻지 않는다.
    expect(miText).not.toContain(PRICE_MEANING_LABEL.SELLER_PLANNED_PRICE);
    expect(miText).not.toContain(PRICE_MEANING_LABEL.EXPECTED_MARGIN);
    // 관부가세는 엔진에서 빠졌다(8ac100d). 화면에도 되살아나지 않는다.
    expect(miText).not.toContain("관세");
    expect(miText).not.toContain("부가세");
  });

  /**
   * ── 지시 ④ ──────────────────────────────────────────────────────────────
   * 되물음은 접혀 있고, Radar는 그 안에서 한 단계 더 들어가야 나온다.
   */
  it("되물음은 접혀 있고 Radar·시장 신호·장문 설명이 첫 화면에 없다", () => {
    expect(miText).toContain("왜 이렇게 판단했나요?");
    expect(miHtml).not.toContain("<svg");
    for (const banned of [
      PRICE_SECTION_TITLE.DECISION_EVIDENCE,
      "판단 근거",
      "시장 신호",
      "가격·판매 전략 가이드",
      "종합 시장 상태",
      "동일상품 근거",
      "아직 확인되지 않은 비용",
      "상표권",
      "참고용 판단입니다",
      "분석 기준 시장",
      "다시 확인",
      "👉",
    ]) {
      expect(miText, `${banned}이(가) 첫 화면에 있다`).not.toContain(banned);
    }
    // 판정을 설명하는 긴 문장은 되물음 안쪽 한 단계 더 아래다.
    expect(miText).not.toContain(productionData().representativeVerdict.description);
  });

  it("되물음이 답하는 것은 네 줄이고, 접혀 있는 동안 화면에 없다", () => {
    const lines = buildMiVerdictExplanation({
      marketCase: "D",
      hasComparable: false,
      evidenceBasis: "NONE",
      hasOverseasRange: false,
    });
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(miText).not.toContain(line);
  });

  /**
   * ── 지시 ⑤(STOP) ───────────────────────────────────────────────────────
   * 국내 배송원가는 LANDED_COST_PARTS에 들어 있어 판정을 움직인다. 지우지도
   * 숨기지도 않는다 — 첫 화면에 없는 것은 **접혀 있기 때문**이지 사라져서가
   * 아니라는 사실은 product-tab-mounted.test.ts가 실제로 열어서 확인한다.
   */
  it("판단 카드는 상세 계산 슬롯을 여는 토글을 그대로 갖고 있다", () => {
    expect(miText).toContain("ⓘ 가격 계산 기준");
  });
});

/**
 * ── 어느 블록이 MI이고 어느 블록이 아닌가 ───────────────────────────────────
 * 이 구분이 지난 세 번의 실패에서 한 번도 측정되지 않은 것이다. 첫 화면이
 * 길다는 관찰은 MI가 길다는 뜻이 아닐 수 있다 — 아래 목록이 그 답이다.
 */
describe("첫 화면의 길이는 MI가 아니라 그 아래가 정한다", () => {
  it("② 시장 판단 단계에서 MI 아래에 서는 가격비교 두 패널은 접혀 있다", () => {
    const { stage } = regionsOf(render(MARKET_STAGE));
    expect(headingsInOrder(stage)).toEqual([
      "지금 단계 · 2. 시장 판단",
      // MI-MARKET-EVIDENCE-1 — 제목은 그대로 서지만 표는 접혔다. 이 둘은 이제
      // 위 요약의 드릴다운 대상이고, 펼쳐져 있으면 같은 가격이 두 벌 뜬다.
      "🇰🇷 한국 시장 · 국내 비교상품 (베타)",
      "🌎 글로벌 시장 · 해외 판매처 가격 (베타)",
      "💰 판매가격 확정",
      "이미지",
      "Source Data",
      "Backlog",
    ]);
    // 접힘 요약 한 줄은 무엇이 열리는지 말한다 — "열어봐야 아는" 접힘을 만들지 않는다.
    const text = visibleText(stage);
    expect(text).toContain("판매처 · 상품 · 가격 · 재고 · 매칭상태");
    expect(text).toContain("판매처 · 국가 · 상품 · 가격 · 매칭상태");
  });

  it("③ 등록 준비에서 MI를 펼쳐도 MI 자신의 제목 수는 변하지 않는다", () => {
    const { mi } = regionsOf(render(PREPARE_STAGE_MI_OPEN));
    expect(headingsInOrder(mi)).toEqual([
      "Market Intelligence",
      "원본 상품",
      "ⓘ 글로벌 시장 가격",
      /**
       * 🔴 WU-141-R3 — 「🇰🇷 국내 시장」·「🌎 해외 시장」이 **여기 없다.**
       *    둘은 결론 영역 「📊 시장 판매 판단」(`MarketPriceComparison` · 격자 «밖»
       *    최상단 · WU-140-R1)으로 올라갔다 ⟹ 셀러는 그 둘을 **더 먼저** 읽는다.
       *    🔴 이 하니스는 격자 왼쪽 기둥 + ActionCenter 만 조립하므로 그 영역이
       *       **트리에 없다**(CommerceWorkspace 가 주인이다).
       */
      "수익성",
      "ⓘ 가격 계산 기준",
      "왜 이렇게 판단했나요?",
    ]);
  });

  it("③ 등록 준비에서 MI가 접히면 제목 없는 한 줄 요약이다", () => {
    const { mi } = regionsOf(render());
    expect(headingsInOrder(mi)).toEqual([]);
    expect(visibleText(mi)).toContain("이 단계에서는 결론만 보여줍니다");
  });

  /**
   * 오른쪽 기둥은 판단 화면에서 **누를 수 있는 것 하나**만 갖는다(MI-POLISH-2).
   * 채널마다 카드가 하나씩 생기던 화면이 되살아나면 여기서 걸린다.
   */
  it("오른쪽 기둥은 판단 화면에서 카드 셋이고 채널 버튼을 반복하지 않는다", () => {
    const { aside } = regionsOf(render(MARKET_STAGE));
    expect(headingsInOrder(aside)).toEqual(["판매 판단", "등록 전 확인", "커머스 등록"]);
    const text = visibleText(aside);
    expect(text).toContain("스마트스토어 · 쿠팡 · 11번가 — 판단 뒤에 등록합니다.");
    expect(text).not.toContain("화면 열기");
    expect(text).not.toContain("준비중");
  });
});
