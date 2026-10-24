import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverseasReferencePrice } from "../OverseasReferencePrice";
import {
  DOMESTIC_REFERENCE_NOTE,
  DOMESTIC_REFERENCE_SCOPE,
  DOMESTIC_REFERENCE_TITLE,
  OVERSEAS_REFERENCE_SCOPE,
  OVERSEAS_REFERENCE_TITLE,
  type OverseasPriceSummary,
} from "../overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-056 — **국내 집계가 응답을 타고 화면까지 온다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 WU-055 가 국내 가격 evidence 를 `VERIFIED_CURRENT` 까지 올렸는데 **집계가
 *    화면에 닿지 않았다.** 추적 결과 끊긴 곳이 **둘** 이었다:
 * ```
 * ① POST /check 응답에 국내 집계 칸이 **없다**(해외만 있었다 — WU-049)
 * ② 패널이 POST 직후 `loadPriceHistory()`(GET)로 **덮어쓴다**(Panel:2093)
 *    GET 경로는 transient 를 넘기지 않으므로 그 값에는 이번 후보가 없다
 * ```
 * 🟢 그래서 **별 칸**(`candidateDomesticPrice` → `domesticReference`)으로 내보낸다.
 *    🔴 `domesticCompetition`(권위 집계)·판매판정·국내 최저가는 건드리지 않는다.
 *
 * 🟢 **새 컴포넌트를 만들지 않았다** — WU-049 블록의 문구만 주입구로 열었고
 *    기본값이 해외 상수라 기존 계약 17건은 그대로 통과한다.
 */

const SUMMARY: OverseasPriceSummary = {
  count: 3,
  byCurrency: { KRW: { count: 3, lowestAmount: 88_000 } },
  byMarket: { KR: 3 },
  byPriceTier: { COMPARISON: 3 },
};

const renderDomestic = (summary: OverseasPriceSummary | null) =>
  renderToStaticMarkup(
    OverseasReferencePrice({
      summary,
      title: DOMESTIC_REFERENCE_TITLE,
      note: DOMESTIC_REFERENCE_NOTE,
      scope: DOMESTIC_REFERENCE_SCOPE,
      icon: "🇰🇷",
      testId: "domestic-reference",
      amountTestId: "domestic-lowest",
    }) as never,
  );

/* ══════════════ A. 🟢 국내 블록이 실제로 그려진다 ══════════════ */

describe("A. 국내 참고가격 블록", () => {
  it("🟢 KRW 최저가와 판매처 수를 적는다", () => {
    const html = renderDomestic(SUMMARY);
    expect(html).toContain("국내 참고가격");
    expect(html).toContain("KRW 88,000");
    expect(html).toContain("판매처 3곳");
  });

  /** 🔴 환산하지 않는다 — 금액 줄에 다른 통화/환산 흔적이 없다. */
  it("🔴 금액 줄이 KRW 그대로다", () => {
    const html = renderDomestic(SUMMARY);
    const amounts = [...html.matchAll(/data-testid="domestic-lowest"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(amounts).toEqual(["KRW 88,000"]);
    expect(html).not.toMatch(/[€$£¥]/);
  });

  /** 🔴 값이 없으면 구역을 만들지 않는다 — 「0건」으로 칸을 세우지 않는다. */
  it.each([null, { count: 0, byCurrency: {}, byMarket: {}, byPriceTier: {} }])(
    "🔴 %# → 아무것도 렌더하지 않는다",
    (s) => {
      expect(renderDomestic(s as OverseasPriceSummary | null)).toBe("");
    },
  );

  /**
   * 🔴🔴 **국내 문구는 해외 문구를 복사하지 않는다.**
   *    「판매판정과 국내 최저가에는 반영되지 않습니다」를 국내에 쓰면 **단정** 이 된다 —
   *    POST `/check` 가 transient 를 포함한 `sellerAction` 으로 `price_alerts` 를
   *    갱신하기 때문이다(check/route.ts:168-183). 🔴 문구 확대는 제품 정책이라
   *    하지 않았고, **확실한 사실만** 적는다(저장 안 됨 · 새로고침하면 사라짐).
   */
  it("🔴🔴 국내 문구가 «판매판정 미반영» 을 단정하지 않는다", () => {
    expect(DOMESTIC_REFERENCE_SCOPE).not.toMatch(/판매판정/);
    expect(DOMESTIC_REFERENCE_SCOPE).not.toMatch(/국내 최저가/);
    expect(DOMESTIC_REFERENCE_SCOPE).toMatch(/저장되지 않습니다/);
    /** 🟢 반대로 해외 문구는 그 단정을 **유지** 한다(그쪽은 참이다). */
    expect(OVERSEAS_REFERENCE_SCOPE).toMatch(/판매판정/);
  });

  /**
   * 🔴🔴 **실데이터에서 찾은 어휘 누출** — 해외 집계는 tier 를 거르지 않으므로
   *    `EXCLUDED` 가 들어온다(GT 51건 실측: EXACT 10 · COMPARISON 2 · REFERENCE 2 ·
   *    **EXCLUDED 2**). 그 어휘가 `TIER_LABEL` 에 없어 화면에 영문 토큰이 찍혔다.
   * 🔴 **집계에서 빼지 않았다**(WU-049 숫자가 바뀐다) — 라벨만 붙였다.
   */
  it("🔴🔴 집계 등급에 영문 내부 토큰이 새지 않는다", () => {
    const html = renderDomestic({
      count: 4,
      byCurrency: { KRW: { count: 4, lowestAmount: 88_000 } },
      byMarket: { KR: 4 },
      byPriceTier: { EXACT: 1, COMPARISON: 1, REFERENCE: 1, EXCLUDED: 1 },
    });
    expect(html).toContain("동일상품 1");
    expect(html).toContain("유사상품 1");
    expect(html).toContain("참고 1");
    expect(html).toContain("동일상품 아님 1");
    /** 🔴 대문자 내부 토큰이 **하나도** 남지 않아야 한다. */
    expect(html).not.toMatch(/EXCLUDED|REFERENCE|COMPARISON|EXACT|CONFIRMED/);
  });

  /** 🟢 기본값이 해외다 — WU-049 호출부가 한 글자도 바뀌지 않는다. */
  it("🟢 props 없이 쓰면 해외 블록이다", () => {
    const html = renderToStaticMarkup(OverseasReferencePrice({ summary: SUMMARY }) as never);
    expect(html).toContain(OVERSEAS_REFERENCE_TITLE);
    expect(html).toContain('data-testid="overseas-reference"');
  });
});

/* ══════════════ B. 🔴 배선 — 응답 → state → 렌더 ══════════════ */

describe("B. 배선", () => {
  const repoRoot = (() => {
    let dir = __dirname;
    for (let i = 0; i < 12; i++) {
      if (existsSync(path.join(dir, "packages", "crawler", "package.json"))) return dir;
      dir = path.dirname(dir);
    }
    throw new Error("repo 루트를 찾지 못했다");
  })();
  const strip = (p: string) =>
    readFileSync(path.join(repoRoot, p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  const ROUTE = strip("apps/admin/src/app/api/price-history/check/route.ts");
  const PANEL = strip("apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx");
  const INTEL = strip("apps/admin/src/app/api/price-history/_lib/market-intelligence.ts");

  /** 🔴 대입만 보면 속는다 — **응답 객체 안에** 실리는지 본다. */
  it("route 가 응답에 domesticReference 를 싣는다", () => {
    const ret = ROUTE.slice(ROUTE.lastIndexOf("return NextResponse.json({"));
    expect(ret).toContain("domesticReference: intelligence?.candidateDomesticPrice ?? null");
    /** 🟢 해외 칸도 그대로 있다(WU-049 회귀 방어). */
    expect(ret).toContain("overseasReference: intelligence?.candidateOverseasPrice ?? null");
  });

  it("MI 가 국내 transient 집계를 낸다", () => {
    expect(INTEL).toContain("candidateDomesticPrice: summarizeCandidateOverseasPrices(domesticTransientRecords)");
    /** 🔴 **같은 집계기** 를 쓴다 — 사본을 만들지 않았다. */
    expect(INTEL).toContain("candidateOverseasPrice: summarizeCandidateOverseasPrices(overseasEvidence)");
  });

  /**
   * 🔴🔴 **권위 집계를 오염시키지 않았다.** `domesticTransientRecords` 는
   *    `exactShopRecords`/`comparisonShopRecords` 와 **별 배열** 이고,
   *    `summarizeDomesticMarketSplit`(국내 최저가 계산)에 들어가지 않는다.
   */
  it("🔴 국내 최저가 계산에 새 배열이 들어가지 않는다", () => {
    const split = INTEL.slice(INTEL.indexOf("summarizeDomesticMarketSplit("), INTEL.indexOf("]);", INTEL.indexOf("summarizeDomesticMarketSplit(")));
    expect(split).not.toContain("domesticTransientRecords");
  });

  /**
   * 🔴🔴 WU-132 ③ — **구역의 «자리» 가 바뀌었다(값과 성질은 그대로).** 가격 비교
   *    영역을 둘 두지 않기 위해 MI 패널의 `unified-price-comparison` 을 제거했고,
   *    🇰🇷 블록은 「📊 동일상품 가격 비교」(`MarketPriceComparison`)로 **옮겼다**.
   * 🔴 앵커를 갱신하며 **사슬 전체로 강화** 한다(올려보내는 선까지 단언한다).
   */
  it("Panel 이 그 값을 받아 «가격비교 영역» 으로 올려보내고, 그 영역이 그린다", () => {
    expect(PANEL).toContain("setDomesticReference(json.domesticReference ?? null)");
    expect(PANEL).toContain("onMarketComparisonChangeRef.current?.(marketComparisonInput)");
    expect(PANEL).toContain("domesticReference,");
    const AREA = strip("apps/admin/src/app/pipeline/commerce/MarketPriceComparison.tsx");
    expect(AREA).toContain('testId: "domestic-reference"');
    /**
     * 🔴🔴 CORE-2R-5 — **그 블록이 「2차 접힘」에서 「1차 🇰🇷 블록」으로 올라갔다.**
     *    전에는 `MarketColumn` 에 `reference={domesticReference}` 로 넘겼고, 그 자리는
     *    `▸ MI 상세 분석` **안** 이라 셀러가 볼 수 없었다 — 국내 가격을 찾아 놓고도
     *    화면이 「찾지 못했습니다」만 말했다(CORE-2R-4 실측 · 2곳 × KRW 88,000).
     * 🟢 지금은 `MarketBlock` 이 그 집계를 받아 **1차** 에서 그린다.
     * 🔴 **복제가 아니다** — 2차는 `reference={null}` 로 껐고, 「영역에 하나뿐」은
     *    마운트 DOM 으로 `core-2r5-domestic-reference-to-mi` A-2 가 단언한다.
     */
    /**
     * 🔴🔴🔴 **CORE-2S §5-④ 에서 이 앵커의 «모양» 이 바뀌었다 — 약해지지 않았다.**
     *
     * 🔴 전 앵커는 `domesticReference={domesticReference}` 라는 **prop 이름** 을 봤다.
     *    그런데 해외 집계도 **1차로 올라가면서**(비대칭 제거) 두 시장이 **같은 prop**
     *    (`reference`)을 쓰게 됐다 — 이름이 국내에 묶여 있으면 해외가 올라갈 자리가 없다.
     * 🟢 그래서 지키는 성질을 **그대로** 적는다: 🇰🇷 블록이 **국내 집계를 받아** 1차에서
     *    그린다. ⟹ 배선을 끊거나 해외 집계를 국내 자리에 넣으면 FAIL 한다.
     */
    expect(AREA).toContain('reference={mk === "KR" ? domesticReference : overseasReference}');
    expect(AREA).toContain('testId: "domestic-reference"');
    /** 🔴 1차 🇰🇷 블록이 그 집계의 소비자여야 한다 — `MarketBlock` 이 `reference` 를 받는다. */
    expect(AREA).toContain("reference?: OverseasPriceSummary | null");
    /** 🔴🔴 **옮긴 것이 맞다** — 패널이 그 블록을 더 이상 그리지 않는다(둘이 되면 FAIL). */
    expect(PANEL).not.toContain('testId="domestic-reference"');
  });

  /** 🔴 transient 저장 금지 불변식이 그대로다. */
  it("🔴 transient 저장 차단이 살아 있다", () => {
    const runner = strip("apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts");
    expect(runner).toContain("if (isTransientShopId(shopId)) return;");
  });
});
