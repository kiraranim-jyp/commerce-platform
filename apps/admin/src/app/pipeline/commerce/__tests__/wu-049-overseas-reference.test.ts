import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverseasReferencePrice } from "../OverseasReferencePrice";
import {
  OVERSEAS_REFERENCE_NOTE,
  OVERSEAS_REFERENCE_SCOPE,
  buildOverseasReference,
  type OverseasPriceSummary,
} from "../overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-049 — **해외 동일상품 참고가격이 화면까지 닿는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 추적 결과 원인은 「UI 가 안 읽어서」가 아니라 **「응답에 없어서」** 였다:
 * ```
 * POST /check  intelligence 를 **계산하고 버렸다**(알림 계산에만 썼다)
 * GET  /[id]   인자 2개 → transient null → candidateOverseasEvidence **항상 []**
 * ```
 * 🟢 개별 후보는 WU-028 구역이 이미 통화 그대로 그리고 있었다. 빠진 것은 **집계** 다.
 *
 * 🔴🔴 **이 파일이 같이 잠그는 CPO 금지항**:
 * ```
 * 환율 환산 0 · 해외 SAME 을 국내 SAME 으로 간주 0 · PRESUMED→EXACT 승격 0 ·
 * transient 저장 0 · threshold 0 · identity 로직 변경 0
 * ```
 */

const render = (summary: OverseasPriceSummary | null) =>
  renderToStaticMarkup(OverseasReferencePrice({ summary }) as never);

const SUMMARY: OverseasPriceSummary = {
  count: 3,
  byCurrency: { EUR: { count: 2, lowestAmount: 40 }, USD: { count: 1, lowestAmount: 58 } },
  byMarket: { OVERSEAS: 3 },
  byPriceTier: { EXACT: 2, COMPARISON: 1 },
};

/* ══════════════ A. 🔴 환산하지 않는다 ══════════════ */

describe("A. 통화를 섞지도 환산하지도 않는다", () => {
  it("🟢 통화별 최저가를 ISO 코드 그대로 적는다", () => {
    const html = render(SUMMARY);
    expect(html).toContain("EUR 40");
    expect(html).toContain("USD 58");
  });

  /**
   * 🔴🔴 **환산된 «금액» 이 생기면 안 된다.**
   * 🔴 처음엔 구역 전체에 `/환율/` 금지를 걸었다가 **내 안내문**
   *    (「환율로 환산하지 «않았습니다»」)에 걸렸다 — 설명문과 데이터를 섞어
   *    단언한 것이다. 그래서 **금액 줄만** 본다.
   */
  it("🔴 금액 줄에 KRW·환산 흔적이 없다", () => {
    const html = render(SUMMARY);
    const amounts = [...html.matchAll(/data-testid="overseas-lowest"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(amounts.length).toBe(2);
    for (const a of amounts) {
      expect(a).not.toMatch(/KRW|원|≈|약/);
      expect(a).toMatch(/^(EUR|USD) [\d,]+$/);
    }
    /** 🔴 그리고 구역 어디에도 «환산된 합계» 칸이 없다. */
    expect(html).not.toMatch(/합계|총액|convertedTo|exchangeRate/i);
  });

  /** 🔴 통화 기호로 바꾸지 않는다 — 기호는 통화를 잃는다(USD/AUD 가 둘 다 `$`). */
  it("🔴 통화를 기호로 바꾸지 않는다", () => {
    expect(render(SUMMARY)).not.toMatch(/[€$£¥]/);
  });

  it("🟢 통화 순서를 금액으로 매기지 않는다 (코드 사전순)", () => {
    const v = buildOverseasReference(SUMMARY)!;
    expect(v.lines.map((l) => l.currency)).toEqual(["EUR", "USD"]);
  });
});

/* ══════════════ B. 🔴 없는 것을 있는 척하지 않는다 ══════════════ */

describe("B. 값이 없으면 구역 자체가 없다", () => {
  it.each([null, { count: 0, byCurrency: {}, byMarket: {}, byPriceTier: {} }])(
    "🔴 %# → 아무것도 렌더하지 않는다",
    (s) => {
      expect(render(s as OverseasPriceSummary | null)).toBe("");
      expect(buildOverseasReference(s as OverseasPriceSummary | null)).toBeNull();
    },
  );

  /** 🔴 후보는 있는데 **금액이 하나도 없으면** 줄을 만들지 않는다. */
  it("🔴 금액이 없으면 null 이다 (0원을 만들지 않는다)", () => {
    expect(
      buildOverseasReference({ count: 2, byCurrency: {}, byMarket: { OVERSEAS: 2 }, byPriceTier: { EXACT: 2 } }),
    ).toBeNull();
  });

  /** 🔴 `UNKNOWN` 시장을 **해외로 단정하지 않는다** — 그 사실을 적는다. */
  it("🔴 시장 미확인은 그렇게 적는다", () => {
    const html = render({ ...SUMMARY, byMarket: { OVERSEAS: 2, UNKNOWN: 1 } });
    expect(html).toContain("판매 시장을 확인하지 못했습니다");
  });
});

/* ══════════════ C. 🔴🔴 「참고용 · 판매판정 미반영」을 화면이 말한다 ══════════════ */

describe("C. 안전 문구", () => {
  it("🔴 환산하지 않았다는 사실을 적는다", () => {
    expect(render(SUMMARY)).toContain(OVERSEAS_REFERENCE_NOTE);
  });

  /** 🔴🔴 이 문장이 사라지면 셀러가 참고가를 확정 가격으로 읽는다. */
  it("🔴 판매판정·국내 최저가에 반영되지 않는다고 적는다", () => {
    expect(render(SUMMARY)).toContain(OVERSEAS_REFERENCE_SCOPE);
    expect(OVERSEAS_REFERENCE_SCOPE).toMatch(/판매판정/);
    expect(OVERSEAS_REFERENCE_SCOPE).toMatch(/국내 최저가/);
  });

  /** 🟢 등급은 owner 어휘로 **갈라서** 적는다 — 승격이 아니라 분류다. */
  it("🟢 동일상품/유사상품을 합치지 않는다", () => {
    const html = render(SUMMARY);
    expect(html).toContain("동일상품 2");
    expect(html).toContain("유사상품 1");
  });

  /** 🔴 승격 버튼이 없다 — transient 는 DB 로 올라가지 않는다. */
  it("🔴 「동일상품 확인」 같은 승격 버튼이 없다", () => {
    expect(render(SUMMARY)).not.toMatch(/<button|동일상품 확인/);
  });
});

/* ══════════════ D. 🔴 소스 가드 — 배선과 경계를 잠근다 ══════════════ */

describe("D. 배선이 유지된다", () => {
  const repoRoot = (() => {
    let dir = __dirname;
    for (let i = 0; i < 12; i++) {
      if (existsSync(path.join(dir, "packages", "crawler", "package.json"))) return dir;
      dir = path.dirname(dir);
    }
    throw new Error("repo 루트를 찾지 못했다");
  })();
  const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const routeSrc = strip(
    readFileSync(path.join(repoRoot, "apps/admin/src/app/api/price-history/check/route.ts"), "utf8"),
  );
  const panelSrc = strip(
    readFileSync(
      path.join(repoRoot, "apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx"),
      "utf8",
    ),
  );

  /** 🔴 대입만 보면 속는다 — **응답 객체 안에** 실리는지 본다. */
  it("route 가 응답에 overseasReference 를 싣는다", () => {
    const ret = routeSrc.slice(routeSrc.lastIndexOf("return NextResponse.json({"));
    expect(ret).toContain("overseasReference: intelligence?.candidateOverseasPrice ?? null");
  });

  /**
   * 🔴🔴 WU-132 ③ — **구역의 «자리» 가 바뀌었다(값과 성질은 그대로).**
   *
   * 가격 비교 영역을 **둘 두지 않기** 위해 MI 패널 안의 `unified-price-comparison` 을
   * 제거했고, 이 블록은 「📊 동일상품 가격 비교」(`MarketPriceComparison`)로 **옮겼다**.
   *
   * 🔴 그래서 앵커를 갱신하고 **사슬 전체로 강화** 한다 — 「패널이 받는다」만 보면
   *    위로 올려보내는 선이 끊겨도 통과한다(그게 WU-110 에서 당한 계열이다):
   * ```
   * route 응답 → 패널 state → **패널이 위로 보고** → 영역이 그린다
   * ```
   */
  it("Panel 이 그 값을 받아 «가격비교 영역» 으로 올려보내고, 그 영역이 그린다", () => {
    expect(panelSrc).toContain("setOverseasReference(json.overseasReference ?? null)");
    /** 🔴 올려보내는 선 — 이 줄이 없으면 값이 패널 안에서 죽는다. */
    expect(panelSrc).toContain("onMarketComparisonChangeRef.current?.(marketComparisonInput)");
    expect(panelSrc).toContain("overseasReference,");
    /** 🔴 그리는 쪽 — 그 영역이 실제로 이 컴포넌트를 쓴다. */
    const area = strip(
      readFileSync(
        path.join(repoRoot, "apps/admin/src/app/pipeline/commerce/MarketPriceComparison.tsx"),
        "utf8",
      ),
    );
    expect(area).toContain("<OverseasReferencePrice summary={reference}");
    /** 🔴🔴 **옮긴 것이 맞다** — 패널에는 그 컴포넌트가 더 이상 없다(둘이 되면 FAIL). */
    expect(panelSrc).not.toContain("<OverseasReferencePrice");
  });

  /** 🔴🔴 **국내 축을 건드리지 않았다** — route 가 DB 쓰기를 늘리지 않았다. */
  it("🔴 route 에 새 DB 쓰기가 없다", () => {
    expect(routeSrc).not.toMatch(/upsertDomesticProductLink|insertPriceObservation/);
  });

  /** 🔴 transient 저장 금지 불변식이 그대로다. */
  it("🔴 transient 저장 차단이 살아 있다", () => {
    const runner = strip(
      readFileSync(
        path.join(repoRoot, "apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts"),
        "utf8",
      ),
    );
    expect(runner).toContain("if (isTransientShopId(shopId)) return;");
  });

  /** 🔴 이 파일은 환산기를 **import 조차 하지 않는다**. */
  it("🔴 참고가격 모듈이 환율을 모른다", () => {
    const src = readFileSync(path.join(repoRoot, "apps/admin/src/app/pipeline/commerce/overseas-reference.ts"), "utf8");
    expect(src).not.toMatch(/convertToKrw|exchangeRate|fetchLiveExchangeRates/);
  });
});
