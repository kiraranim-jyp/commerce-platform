// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { ProductJudgementSummary } from "../ProductJudgementSummary";
import { buildJudgementSummary } from "../judgement-summary";
import { MARKET_JUDGEMENT_TITLE } from "../mi-same-candidates";
import type { MarketEvidenceSummary } from "../market-evidence";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import { readSourceAt, stripComments } from "./source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-141-R3 — **셀러가 보는 가격 숫자의 owner 는 «하나» 다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴🔴 **이 파일이 막는 사고는 「가격이 틀리는 것」이 아니라 «두 숫자가 다른 것» 이다.**
 *
 * R3 전의 실제 화면 구조(코드로 확인된 것):
 * ```
 * ① 상품 판단 요약        「비교 가격 ₩88,000」  ← 패널의 **첫 번째 자식** · 독자 폴백
 * ② 판정 카드 🇰🇷/🌎       「₩116,600」「£37」    ← market-evidence 집계
 * ③ 해외 가격비교 패널     자기 검색 → 요약 발행   ← `mayShowCandidate` 기준(MI 아님)
 * ④ 📊 시장 판매 판단      GBP 37 · USD 58       ← **MI 기준**(SAME + 판매중 + 검증)
 * ```
 * 🔴 ①②③ 은 전부 ④ 와 **다른 게이트** 를 쓴다. ①은 일시 후보의 **첫 가격** 으로
 *    폴백했고, ③은 `/check` 의 MI verdict 를 **한 번도 보지 않는다.**
 *    ⟹ 같은 화면의 위아래가 다른 숫자를 말할 수 있었고, 그 중 **가장 위에 있던 것이
 *       가장 약한 근거** 였다. 셀러가 가장 먼저 읽는 숫자가 그것이다.
 *
 * 🟢 **전략 Gate(CPO 확정 2026-10-21)** 가 가른 것:
 * ```
 * ① MI 판단        동일상품인가 · 판매중인가 · 가격을 확인할 수 있는가
 * ② 시장 가격 참고  **MI 가 SAME 으로 확정한 상품만** · 국내/해외를 **하나의** 📊 에서
 * ③ 셀러 행동      가격 확인 필요 → 🔗 / 유사·판단불가 → 필요할 때만 근거에서
 * ```
 * ⟹ ②의 owner 는 `MarketPriceComparison` **하나** 다.
 *
 * ── 🔴 이 파일이 «하지 않는» 것 ────────────────────────────────────────────
 * ```
 * ❌ MI 완화 — threshold · 8축 · SAME 기준 · confidence · NO_TITLE_OVERLAP **0**
 * ❌ 판정/집계 계산 — 운영 산출을 읽기만 한다
 * ❌ 데이터 삭제 — 후보 행 · candidate_reviews · human_verdict · 이력 **전부 유지**
 * ❌ 네트워크 · DB
 * ```
 */

/* ═══════════════════ fixture — 실측 모양 그대로(지어낸 칸 0) ═══════════════════ */

/**
 * 🟢 WU-139/140 E2E 가 실제로 관측한 해외 SAME 행(junioredition GBP 37).
 * 🔴 `priceTier`/`matchTruth`/`crossSellerVerdict` 를 **지어내지 않는다** — 운영이
 *    그 조합으로 낸 값이고, 여기서는 게이트를 통과하는 입력으로만 쓴다.
 */
const sameRow = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "junioredition.com",
    title: "Bobo Choses Terry Bermuda Shorts",
    imageUrl: null,
    soldOut: false,
    discoveredUrl: "https://junioredition.com/products/b226ac043",
    matchTruth: "EXACT_IDENTIFIER",
    priceTier: "EXACT",
    crossSellerVerdict: "SAME",
    confidence: 1,
    matchReasons: [],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: 37,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    market: "OVERSEAS",
    basis: "TLD",
    ...over,
  }) as GeminiTransientRow;

const marketSummary = (over: Partial<MarketEvidenceSummary>): MarketEvidenceSummary =>
  ({
    title: "🇰🇷 국내 시장",
    hint: "",
    figure: null,
    figureBasis: null,
    figureEmpty: null,
    scopeLabel: null,
    tiers: [],
    mixedNote: null,
    drillDownLabel: "국내 가격 보기",
    hasEvidence: false,
    ...over,
  }) as MarketEvidenceSummary;

/* ═══════════════════ 소스 — 주석을 벗기고 본다 ═══════════════════ */

/**
 * 🔴 **주석을 벗긴다.** 이 저장소에서 **여덟 번** 걸린 함정이고, 이 WU 의 주석에는
 *    금지된 식별자 이름이 **설명으로** 여러 번 등장한다 ⟹ 벗기지 않으면 아래
 *    negative 단언이 **전부 거짓 FAIL** 한다.
 */
/**
 * 🔴 **늦게 읽는다.** `@vitest-environment jsdom` 에서는 **모듈 최상위** 의
 *    `import.meta.url` 이 file 스킴이 아니라 `readFileSync` 가 던진다
 *    (「The URL must be of scheme file」 — 1차에 수집 단계에서 통째로 실패했다).
 * 🟢 같은 환경의 기존 계약(`mi-ux-final-4`)도 **테스트 안에서** 읽는다 — 그 방식에 맞춘다.
 */
let workspace = "";
let panel = "";
let summarySrc = "";
let comparisonSearch = "";
let checkRoute = "";

beforeAll(() => {
  const read = (relative: string): string => stripComments(readSourceAt(new URL(relative, import.meta.url)));
  workspace = read("../../CommerceWorkspace.tsx");
  panel = read("../DomesticPriceIntelligencePanel.tsx");
  summarySrc = read("../judgement-summary.ts");
  comparisonSearch = read("../ComparisonShopSearch.tsx");
  /** 🔴 서버 라우트도 **여기서** 읽는다 — `it` 안에서는 같은 식이 스킴 오류를 냈다(실측). */
  checkRoute = read("../../../api/price-history/check/route.ts");
  /** 🔴 **읽기 실패를 「통과」로 쓰지 않는다** — 빈 문자열이면 아래 negative 단언이 전부 거짓 PASS 한다. */
  for (const [name, src] of [
    ["CommerceWorkspace", workspace],
    ["DomesticPriceIntelligencePanel", panel],
    ["judgement-summary", summarySrc],
    ["ComparisonShopSearch", comparisonSearch],
    ["api/price-history/check/route", checkRoute],
  ] as const) {
    if (src.length < 500) throw new Error(`${name} 소스를 읽지 못했다(길이 ${src.length})`);
  }
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React 가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const renderOwner = (rows: GeminiTransientRow[] | null): string => {
  act(() => root.render(createElement(MarketPriceComparison, { rows })));
  return container.innerHTML;
};

/* ══════════════════════════ C-1 — owner 는 하나다 ══════════════════════════ */

describe("C-1 seller-facing 가격 숫자의 owner 는 「📊 시장 판매 판단」 하나다", () => {
  /**
   * 🔴🔴 **「하나」를 어떻게 증명하는가** — 두 축을 같이 써야 성립한다:
   * ```
   * ⒜ 운영 렌더 자리가 **하나** 다          ← 이 테스트(소스)
   * ⒝ 그 자리에서 숫자가 **실제로 나온다**   ← C-1-b(마운트 DOM)
   * ⒞ 다른 영역에는 숫자가 **0** 이다        ← C-2 · C-3 · product-tab-first-screen
   * ```
   * 🔴 ⒜만 보면 「자리는 하나인데 아무것도 안 나온다」를 통과시키고,
   *    ⒝만 보면 「두 곳에서 나온다」를 통과시킨다. 그래서 셋을 나눠 둔다.
   */
  it("C-1-a 운영 렌더 자리가 정확히 하나이고 커머스 탭에서는 서지 않는다", () => {
    expect((workspace.match(/<MarketPriceComparison/g) ?? []).length).toBe(1);
    /**
     * 🔴 게이트를 **같이** 단언한다 — 없으면 커머스 탭 맨 위에 「시장 판매 판단」이
     *    선다(CEO 가 「MI 표시 제거」로 지운 그 모양 · WU-140 ① 이 붙인 게이트).
     */
    const site = workspace.slice(workspace.indexOf("<MarketPriceComparison"));
    const before = workspace.slice(0, workspace.indexOf("<MarketPriceComparison"));
    /**
     * 🔴🔴 **WU-152 — 게이트의 «식» 이 바뀌었고 «성질» 은 같다**(2026-10-22).
     * ```
     * 전  stageFocus.mi !== "HIDDEN"      후  workSurface !== "CHANNEL"
     * ```
     * 🔴 WU-152 가 상품정보 탭에서도 MI 패널을 HIDDEN 으로 만들었으므로 옛 식은
     *    **결론 영역까지 같이 지운다**. 🟢 그래서 보호의 **원래 축(탭)** 으로 직접 적는다 —
     *    `stage-focus.ts` 가 `mi = HIDDEN` 을 정하던 그 조건(`surface === "CHANNEL"`)과
     *    **같은 규칙** 이다(약화가 아니다 · 커머스 탭 보호는 그대로다).
     */
    expect(before).toContain('workSurface !== "CHANNEL"');
    expect(site).toContain("rows={");
    /** 🔴 패널 쪽에 그 영역이 생기면 영역이 둘이 된다(WU-132 가 잠근 그 성질). */
    expect(panel).not.toContain("<MarketPriceComparison");
  });

  it("C-1-b 그 자리에서 가격 숫자가 실제로 나온다 — 통합이 숫자를 삭제한 것이 아니다", () => {
    const html = renderOwner([sameRow()]);
    expect(html).toContain(MARKET_JUDGEMENT_TITLE);
    /**
     * 🔴🔴 **이 단언이 R3 의 가장 큰 위험을 막는다** — 「owner 를 하나로 줄였다」가
     *    「숫자가 사라졌다」가 되면 셀러는 판단 근거를 잃는다(지시서 §9).
     *    통화는 **원본 그대로** 다(환산 0).
     */
    expect(html).toContain("37");
    expect(html).toContain("GBP");
    expect(html).not.toContain("₩");
    expect(html).not.toContain("약 ");
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 **변이 M-R3-09 가 기존 계약을 통과했다 — 그래서 이 계약을 새로 만들었다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 `selectMiSameCandidates` 의 `tier !== "SAME"` 게이트를 `=== "CONFLICT"` 로
   *    **느슨하게** 바꿔 돌렸더니 `wu-136` · `wu-139` · `wu-140` **68건이 전부 통과** 했다.
   *    원인은 그 세 파일의 fixture 에 **PRESUMED_SAME/SIMILAR 행이 가격을 들고 들어오는
   *    모양이 없었다** 는 것이다 ⟹ 「보류 후보가 가격 참고로 샌다」를 **아무도 막고
   *    있지 않았다.**
   * 🔴 그런데 그것은 CPO 가 STEP 5 에서 **명시적으로 금지** 한 둘이다:
   * ```
   * SIMILAR → 가격비교            ❌
   * PRESUMED_SAME → 최종 SAME     ❌
   * ```
   * 🟢 그리고 WU-123/125 가 실측했다 — **보류 4건이 전부 Human DIFFERENT** 였다.
   *    즉 보류를 가격 축에 넣으면 **다른 상품의 가격** 이 셀러의 기준가가 된다.
   * 🔴 MI 를 바꾸는 계약이 **아니다** — 이미 그렇게 동작하는 것을 **고정** 할 뿐이다.
   */
  it("C-1-d 🔴 보류·유사 후보는 가격이 확인돼도 가격 축에 들어가지 않는다", () => {
    const pending = sameRow({
      matchTruth: null,
      crossSellerVerdict: "PRESUMED_SAME",
      priceAmount: 21,
      priceCurrency: "GBP",
      discoveredUrl: "https://villagekids.co.uk/p/1",
      domain: "villagekids.co.uk",
    });
    const similar = sameRow({
      matchTruth: null,
      crossSellerVerdict: "SIMILAR",
      priceAmount: 19,
      priceCurrency: "GBP",
      discoveredUrl: "https://other.example/p/2",
      domain: "other.example",
    });
    const html = renderOwner([pending, similar]);
    /**
     * ══════════════════════════════════════════════════════════════════════════
     * 🔴🔴🔴 **CORE-E2E-CLOSE-03 — 이 단언의 «범위» 가 바뀌었다. 약해지지 않았다.**
     * ══════════════════════════════════════════════════════════════════════════
     *
     * 🔴 전까지 「두 금액이 **어디에도** 서지 않는다」였다. 🔴🔴 그런데 **CEO 육안이
     *    FAIL** 했다 — 「국내/해외 가격 비교 후보가 사용자 화면에 노출되지 않는다」 —
     *    그리고 CPO 가 CORE-E2E-CLOSE-03 §3 으로 「`SAME` / `PRESUMED_SAME` 후보를
     *    셀러가 볼 수 있도록 한다」를 **지시** 했다(그 구역은 가격·통화를 적는다).
     *
     * 🟢 그래서 지키는 성질을 「화면에 그 숫자가 없다」에서 **「가격 «축» 에 그 숫자가
     *    들어가지 않는다」로 정정** 한다 — 그것이 WU-141-R3 이 원래 닫은 것이다
     *    (「셀러가 보는 가격 숫자의 owner 가 하나」 = 기준가 · 범위 · 집계).
     *
     * 🟢🟢 **두 방향으로 더 강해졌다**:
     *    ⒜ `SIMILAR`(19)은 **여전히 화면 어디에도** 설 수 없다 — 보류 구역조차
     *       `PRESUMED_SAME` 만 받는다(`selectPresumedCandidates`).
     *    ⒝ `PRESUMED_SAME`(21)은 **`mi-presumed-area` «안» 에만** 설 수 있고 그 구역을
     *       걷어낸 화면에는 **없어야** 한다 ⟹ 집계·기준가·범위로 새 나가면 FAIL 한다
     *       (전에는 「어디에도 없다」가 그 둘을 **구분하지 못했다**).
     */
    const stripPresumed = (h: string): string => {
      const out: string[] = [];
      let rest = h;
      for (;;) {
        const i = rest.indexOf('<details data-testid="mi-presumed-area"');
        if (i < 0) {
          out.push(rest);
          break;
        }
        out.push(rest.slice(0, i));
        const end = rest.indexOf("</details>", i);
        /** 🔴 닫는 태그를 못 찾으면 **통째로 버리지 않는다** — 그러면 단언이 공짜가 된다. */
        expect(end, "🔴 보류 구역의 끝을 찾지 못했다").toBeGreaterThan(i);
        rest = rest.slice(end + "</details>".length);
      }
      return out.join("");
    };
    /** 🔴 SIMILAR 금액은 **어디에도** — 이 쪽은 범위가 한 글자도 넓어지지 않았다. */
    expect(html).not.toContain("19");
    /** 🔴 보류 금액은 **가격 축에 없다**(보류 구역을 걷어낸 화면). */
    expect(stripPresumed(html)).not.toContain("21");
    /** 🟢 그리고 **버려지지도 않는다** — 셀러가 그 구역에서 본다(CEO FAIL 의 수정). */
    expect(html).toContain("21");
    expect(html).toContain('data-testid="mi-presumed-area"');
    /** 🟢 보류가 몇 건인지도 그대로 말한다(WU-133 의 그 문장). */
    expect(html).toContain(MARKET_JUDGEMENT_TITLE);
    /** 🟢 SAME 행을 섞으면 **가격 축에는 그 가격만** 선다 — 게이트가 «행 단위» 다. */
    const mixed = stripPresumed(renderOwner([pending, similar, sameRow()]));
    expect(mixed).toContain("37");
    expect(mixed).not.toContain("21");
    expect(mixed).not.toContain("19");
  });

  it("C-1-c 조회가 돌지 않았으면 영역 자체가 서지 않는다 — 「후보 0」과 다른 사실이다", () => {
    expect(renderOwner(null)).toBe("");
    /** 🟢 돌았는데 0 건이면 영역은 **선다**(WU-130 ② 가 세운 그 구분). */
    expect(renderOwner([])).toContain(MARKET_JUDGEMENT_TITLE);
  });
});

/* ════════════ C-2 — 요약 카드는 가격 숫자를 «만들지 않는다» ════════════ */

describe("C-2 ProductJudgementSummary 는 가격 owner 가 아니다", () => {
  /**
   * 🔴🔴 **가장 강하게 잠그는 자리다.** 이 블록은 패널의 첫 번째 자식이라 셀러가
   *    **가장 먼저** 읽는다 ⟹ 여기 숫자가 ④ 와 다르면 그 즉시 신뢰가 깨진다.
   */
  it("C-2-a 세 출처의 금액이 전부 들어와도 줄을 만들지 않는다", () => {
    const rows = buildJudgementSummary({
      verdictLabel: "조건부 판매",
      domestic: marketSummary({ figure: "₩150,000", figureBasis: "동일상품 최저가", hasEvidence: true }),
      overseas: marketSummary({ title: "🌎 해외 시장", figure: "GBP 37 ~ 58" }),
      transient: [{ sourceLabel: "직접 입력", rows: [sameRow({ priceAmount: 117000, priceCurrency: "KRW" })] }],
    });
    for (const r of rows) {
      expect(`${r.value} ${r.note ?? ""}`, `${r.label} 에 금액이 있다`).not.toMatch(
        /\d{1,3},\d{3}|₩|KRW|GBP|EUR|USD|€|\$|£/,
      );
    }
    /** 🟢 판정·등급·근거 두께는 **남는다**(전략 Gate ①). 가격만 빠진다. */
    expect(rows.map((r) => r.label)).toContain("시장 판단");
    expect(rows.map((r) => r.label)).not.toContain("비교 가격");
    expect(rows.map((r) => r.label)).not.toContain("해외 시장");
    expect(rows.map((r) => r.label)).not.toContain("가격 상태");
  });

  it("C-2-b 마운트 DOM 에도 없다 — 뷰가 prop 을 직접 읽어 찍는 길까지 막는다", () => {
    act(() =>
      root.render(
        createElement(ProductJudgementSummary, {
          verdictLabel: "조건부 판매",
          domestic: marketSummary({ figure: "₩150,000", hasEvidence: true }),
          overseas: marketSummary({ title: "🌎 해외 시장", figure: "GBP 37 ~ 58" }),
          transient: [{ sourceLabel: "직접 입력", rows: [sameRow()] }],
        } as never),
      ),
    );
    const html = container.innerHTML;
    expect(html).toContain("조건부 판매");
    expect(html).not.toContain("150,000");
    expect(html).not.toContain("GBP 37 ~ 58");
    expect(html).not.toContain("판매판정 미반영");
  });

  it("C-2-c 제거한 «폴백 경로» 가 되살아나지 않는다", () => {
    /**
     * 🔴 R3 가 지운 것은 줄이 아니라 **계산** 이다:
     * ```
     * comparePrice = input.domestic?.figure ?? (priced ? priceText(priced.row) : null)
     * ```
     * 🔴 `firstPricedRow` 를 남기면 다음 사람이 그 폴백을 **되살릴 자리** 가 된다.
     */
    expect(summarySrc).not.toContain("firstPricedRow");
    expect(summarySrc).not.toContain("priceText");
    expect(summarySrc).not.toContain("priceConfidenceText");
    expect(summarySrc).not.toContain("priceAmount");
    /** 🟢 등급/판정 owner 는 그대로 쓴다 — 「전부 금지」가 아니다. */
    expect(summarySrc).toContain("verdictDisplay");
  });
});

/* ════════ C-3 — 판정 카드의 시장 두 블록은 운영 렌더 자리가 없다 ════════ */

describe("C-3 두 번째 시장 블록이 판정 카드로 돌아오지 않는다", () => {
  it("C-3-a 운영 렌더 자리 0 — 컴포넌트는 남아 있어도 화면에 서지 않는다", () => {
    /**
     * 🔴 `<MarketComparisonView` / `<OverseasMarketEvidenceView` **렌더** 가 0 이다.
     * 🟢 함수 **정의** 는 남아 있다(`mi-polish` 등이 그 뷰를 직접 렌더해 성질을 본다).
     *    ⟹ 그래서 `export function` 선언은 세지 않고 **JSX 사용** 만 센다.
     */
    for (const view of ["<MarketComparisonView", "<OverseasMarketEvidenceView"]) {
      expect((panel.match(new RegExp(view.replace("<", "<"), "g")) ?? []).length, `${view} 가 렌더된다`).toBe(0);
      expect((workspace.match(new RegExp(view, "g")) ?? []).length, `${view} 가 렌더된다`).toBe(0);
    }
  });

  it("C-3-b 그 블록을 먹이던 집계 사본이 패널에 없다", () => {
    /**
     * 🔴 `buildOverseasMarketEvidence` 를 패널이 다시 부르면 **🌎 집계 사본** 이
     *    생긴다. R3 는 그 호출과 **import 까지** 지웠다(계약 계층에서 발견한 잔재).
     */
    expect(panel).not.toContain("buildOverseasMarketEvidence");
  });
});

/* ════════ C-4 — 아래 검색 패널은 판단을 «발행하지» 않는다 ════════ */

describe("C-4 ComparisonShopSearch 는 검색 UI 다 — 시장 가격 판단을 만들지 않는다", () => {
  it("C-4-a 집계 호출·발행 prop·import 가 전부 없다", () => {
    /**
     * 🔴 이 패널은 `mayShowCandidate` 로 **자기 기준** 으로 거른다(SAME 아닌 후보도
     *    통과 · 품절/가격검증 안 봄) ⟹ 그 산출을 요약으로 발행하면 ④ 와 **다른 수** 가 된다.
     * 🟢 **검색을 없애라는 뜻이 아니다** — 결과 표는 그대로 원자료로 남는다.
     */
    expect(comparisonSearch).not.toContain("buildOverseasMarketEvidence");
    expect(comparisonSearch).not.toContain("onEvidenceChange");
    expect(comparisonSearch).not.toContain("MarketEvidenceSummary");
    /** 🟢 검색 자체는 살아 있다(이 패널이 없어지면 원자료가 사라진다). */
    expect(comparisonSearch).toContain("/api/comparison/search");
  });

  it("C-4-b 배선 쪽에도 그 setter 가 없다", () => {
    expect(workspace).not.toContain("setOverseasMarketEvidence");
    expect(workspace).not.toContain("onEvidenceChange");
  });
});

/* ════════ C-5 — 문구는 ① 의 산출을 읽는다(사본 금지) ════════ */

describe("C-5 되물음 문구의 해외 가격대 입력은 ① 이다", () => {
  it("C-5-a `hasOverseasRange` 가 ① 의 산출에서 온다", () => {
    /**
     * 🔴🔴 ③ 을 지우고 이 입력을 그대로 두면 문구가 **항상** 「확인되지 않았습니다」가
     *    된다 — 📊 가 GBP 37 을 보여주는 화면에서도 그렇게 말한다(R3 의 최대 위험).
     * 🟢 그래서 ① 이 쓰는 그 함수의 산출(`pricedCount`)을 읽는다.
     * 🟢 **행동 축은 `mi-ux-final-4` 가 양방향으로** 본다(행 없음 → false · 가격 확인된
     *    SAME 행 → true). 여기서는 **배선** 만 잠근다(그 둘을 합치면 배선이 끊겨도 통과한다).
     */
    const site = panel.slice(panel.indexOf("buildMiVerdictExplanation({"));
    expect(site).toContain("hasOverseasRange: miOverseasGuide.pricedCount > 0");
    expect(site).not.toContain("overseasEvidence.figure");
  });
});

/* ════════ C-6 — 후보는 1차 화면의 주인이 아니다(R2 보존) ════════ */

describe("C-6 후보 구역은 기본으로 접혀 있고 데이터는 하나도 지우지 않았다", () => {
  it("C-6-a `open` 을 붙인 후보 구역이 없다", () => {
    /**
     * 🔴 펼치면 후보가 「유력」으로 읽힌다(2026-09-19 사고 기전). R2 가 접었고
     *    R3 에서 되살아나면 FAIL 이다.
     */
    expect(panel).not.toMatch(/<details\s+open/);
  });

  it("C-6-b 후보 데이터·사람 판단 경로는 그대로다 — 표시 위치만 바꿨다", () => {
    /**
     * 🔴🔴 **1차에 이 단언이 틀렸고, 그 사실을 남긴다** — `human_verdict` 를 UI 파일에서
     *    찾았는데 그것은 **DB 칸 이름** 이고 owner 는 서버다
     *    (`api/price-history/_lib/candidate-review.ts`). 🟢 계약이 FAIL 로 잡았다.
     *    🔴 그대로 「사람 판단 경로가 사라졌다」로 읽었으면 **거짓 결론** 이었다.
     *    (이 트랙에서 반복된 「칸 이름/owner 를 추측했다」의 또 한 번이다.)
     * 🟢 UI 축에서 확인할 수 있는 것은 **저장/조회 호출이 살아 있다** 는 것이다.
     */
    expect(panel).toContain("/candidate-reviews");
    expect(panel).toContain("reviewSnapshotId");
  });
});

/* ════════ C-7 — 서버/판정은 한 글자도 바뀌지 않았다 ════════ */

describe("C-7 R3 는 UI owner 통합이다 — 판정·집계·알림을 건드리지 않았다", () => {
  it("C-7-a 패널에 MI 완화 어휘가 들어오지 않았다", () => {
    for (const banned of ["SAME_MIN_AXES", "threshold", "NO_TITLE_OVERLAP", "BRAND_UNCONFIRMED"]) {
      expect(panel, `${banned} 가 UI 에 들어왔다`).not.toContain(banned);
    }
  });

  it("C-7-b 집계·알림 owner 는 서버에 그대로 있다", () => {
    /**
     * 🔴🔴 **1차에 이 단언도 틀렸다** — `computeMarketIntelligence` 를 `CommerceWorkspace`
     *    에서 찾았는데 그 함수는 **서버 전용** 이고 호출부는 `/api/price-history/check`
     *    와 `/api/price-history/[snapshotId]` 다. 🟢 계약이 FAIL 로 잡았다.
     * 🔴 「UI 에서 호출된다」로 적었으면 **경로를 틀리게 기록** 하는 것이었다.
     * 🟢 그래서 **서버 라우트** 에서 확인한다 — R3 는 그 파일을 건드리지 않았다.
     */
    expect(checkRoute).toContain("computeMarketIntelligence");
    /** 🔴 UI 가 그 계산을 **대신하지** 않는다 — 패널에 집계 함수가 들어오면 FAIL. */
    expect(panel).not.toContain("computeMarketIntelligence");
  });
});
