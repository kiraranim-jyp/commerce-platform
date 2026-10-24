/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { computeSellability, summarizeDomesticMarketSplit, type PriceObservationRecord } from "@commerce/pricing";
import { summarizeCandidateOverseasPrices } from "../../../api/price-history/_lib/candidate-market";
import { MarketPriceComparison } from "../MarketPriceComparison";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2R-5 — **이미 만든 국내 가격 evidence 의 «소비 경로» 를 연다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-24) — 「**SAME 판정을 더 파고드는 방향으로 가면 안 된다.** 현재
 * 확보된 국내 `COMPARISON` 2곳 × ₩88,000 을 기존 가격 판단 체계에 연결해서 국내 가격
 * 기준을 만들어 주는 것이 다음 핵심」.
 *
 * 🔴 그래서 이 파일이 잠그는 것은 **둘** 이다:
 * ```
 * ① 화면  SAME 이 0 이어도 **국내 참고가격이 1차에 보인다** · 🔴 **두 곳에 뜨지 않는다**
 * ② MI    `exact` 가 0 이면 **`comparison` 이 판정 입력이 된다**(EXACT 우선 · 없을 때)
 * ```
 * 🔴 **승격이 아니다** — `PRESUMED_SAME → SAME` · threshold · identity **전부 0**
 *    (그 금지도 아래에서 소스로 단언한다).
 */

const COMMERCE = join(__dirname, "..");
const MPC = readFileSync(join(COMMERCE, "MarketPriceComparison.tsx"), "utf8");
const MI = readFileSync(
  join(COMMERCE, "..", "..", "api", "price-history", "_lib", "market-intelligence.ts"),
  "utf8",
);
/** 🔴 소스 검사는 **주석을 벗기고** 한다(이 저장소에서 여덟 번 걸린 함정). */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const MPC_CODE = strip(MPC);
const MI_CODE = strip(MI);

/** 🟢 CORE-2R-4 실측 그대로 — 국내 후보 둘, 둘 다 `PRESUMED_SAME` · `KRW 88,000`. */
const ROWS: GeminiTransientRow[] = [
  {
    domain: "donokids.com",
    discoveredUrl: "https://www.donokids.com/shop/shopdetail.html?branduid=3362785",
    title: "[보보쇼즈] Hug Hairy Monster T-shirt #226AC009",
    priceAmount: 88000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    market: "KR",
    soldOut: null,
    matchTruth: "TEXT_CONFIRMED",
    crossSellerVerdict: "PRESUMED_SAME",
  },
  {
    domain: "miniboutique.co.kr",
    discoveredUrl: "https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac009/28043/",
    title: "보보쇼즈 티셔츠 B226AC009",
    priceAmount: 88000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    market: "KR",
    soldOut: null,
    matchTruth: "TEXT_CONFIRMED",
    crossSellerVerdict: "PRESUMED_SAME",
  },
];

/** 🟢 MI 가 실제로 내는 모양 — `EXACT | COMPARISON` 을 담는 기존 집계다. */
const DOMESTIC_REFERENCE: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON" },
  { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON" },
]);

function mount(props: Parameters<typeof MarketPriceComparison>[0]): string {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    root.render(createElement(MarketPriceComparison, props));
  });
  const html = host.innerHTML;
  act(() => root.unmount());
  host.remove();
  return html;
}

/* ═══════════════════ A. 화면 — 1차에서 국내 가격이 보인다 ═══════════════════ */

describe("CORE-2R-5 A — 국내 참고가격이 1차 🇰🇷 블록에 선다", () => {
  it("A-1 🟢🟢 SAME 0 인데 **₩88,000 이 화면에 뜬다**", () => {
    const html = mount({ rows: ROWS, domesticReference: DOMESTIC_REFERENCE });
    const block = html.slice(html.indexOf('data-testid="market-block-domestic"'));
    const end = block.indexOf('data-testid="market-block-overseas"');
    const kr = end > 0 ? block.slice(0, end) : block;
    expect(kr, "🔴 1차 🇰🇷 블록에 국내 참고가격이 없다").toContain('data-testid="domestic-reference"');
    expect(kr).toContain("KRW 88,000");
    expect(kr).toContain("국내 참고가격");
  });

  /** 🔴🔴 같은 숫자가 두 곳에 뜨면 WU-145/149 의 「가격 owner 하나」가 깨진다. */
  it("A-2 🔴 `domestic-reference` 구역이 화면에 **하나뿐** 이다", () => {
    const html = mount({ rows: ROWS, domesticReference: DOMESTIC_REFERENCE });
    expect((html.match(/data-testid="domestic-reference"/g) ?? []).length).toBe(1);
    expect((html.match(/KRW 88,000/g) ?? []).length).toBe(1);
  });

  /** 🔴 2차(`▸ MI 상세 분석`)의 국내 집계는 **꺼져 있다** — 옮긴 것이지 복제가 아니다. */
  it("A-3 🔴 2차 국내 칸은 집계를 그리지 않는다(소스 앵커)", () => {
    const at = MPC_CODE.indexOf('testId="mi-same-domestic"');
    expect(at).toBeGreaterThan(0);
    const block = MPC_CODE.slice(at, at + 600);
    expect(block, "🔴 2차 국내 칸이 다시 집계를 그린다 — 가격이 두 번 뜬다").toContain("reference={null}");
  });

  /** 🔴 해외 축은 **건드리지 않았다** — 그 집계는 2차 자리에 그대로다. */
  it("A-4 🟢 해외 2차 칸은 집계를 그대로 그린다", () => {
    const at = MPC_CODE.indexOf('testId="mi-same-overseas"');
    expect(at).toBeGreaterThan(0);
    expect(MPC_CODE.slice(at, at + 400)).toContain("reference={overseasReference}");
  });

  /** 🔴 SAME 이 **있으면** 참고가격 줄을 그리지 않는다(EXACT 우선 · 숫자 둘 금지). */
  it("A-5 🔴 SAME 이 있으면 국내 참고가격을 **같이 띄우지 않는다**", () => {
    const sameRows: GeminiTransientRow[] = [{ ...ROWS[0], matchTruth: "EXACT_IDENTIFIER", crossSellerVerdict: "SAME" }];
    const html = mount({ rows: sameRows, domesticReference: DOMESTIC_REFERENCE });
    expect(html).toContain('data-testid="price-guide-domestic"');
    expect((html.match(/data-testid="domestic-reference"/g) ?? []).length).toBe(0);
  });

  /** 🔴 집계가 없으면 **칸을 만들지 않는다**(「0건」·「-」로 아는 척하지 않는다). */
  it("A-6 🔴 국내 집계가 null 이면 줄이 서지 않는다", () => {
    const html = mount({ rows: ROWS, domesticReference: null });
    expect(html).not.toContain('data-testid="domestic-reference"');
    expect(html).toContain('data-testid="market-empty-domestic"');
  });

  /** 🔴 환산 흔적 0 — 이 영역의 기존 계약(`wu-056r1` 계열)을 그대로 지킨다. */
  it("A-7 🔴 금액 줄에 `₩`·`약`·통화기호가 없다", () => {
    const html = mount({ rows: ROWS, domesticReference: DOMESTIC_REFERENCE });
    const kr = html.slice(
      html.indexOf('data-testid="market-block-domestic"'),
      html.indexOf('data-testid="market-block-overseas"'),
    );
    expect(kr).not.toMatch(/[₩€$£¥]/);
    expect(kr).not.toContain("약 ");
  });
});

/* ═══════════════ B. MI — EXACT 우선 · 없으면 COMPARISON ═══════════════ */

function rec(id: string, krw: number): PriceObservationRecord {
  return {
    id,
    snapshotId: "s",
    source: "DOMESTIC_SHOP",
    sourceLabel: id,
    sourceProductUrl: `https://${id}/p`,
    sourceRefId: null,
    currency: "KRW",
    priceAmount: krw,
    shippingCostAmount: null,
    taxAmount: null,
    exchangeRate: null,
    priceKrw: krw,
    salePriceKrw: null,
    originalPriceKrw: null,
    soldOut: null,
    marketCode: null,
    marketCountry: null,
    shippingPolicyStatus: null,
    shippingPolicyNote: null,
    checkedAt: "2026-10-24T00:00:00.000Z",
  };
}

describe("CORE-2R-5 B — 국내 가격 evidence 가 MI 판정 입력이 된다", () => {
  /** 🔴 이 한 줄이 「국내 가격을 찾아 놓고 MI 가 못 쓴다」를 끝낸다. */
  it("B-1 🔴🔴 판정 입력이 `resolved` 다 — `exact` 단독이 아니다(소스 앵커)", () => {
    const at = MI_CODE.indexOf("computeSellability({");
    expect(at).toBeGreaterThan(0);
    const block = MI_CODE.slice(at, at + 300);
    expect(block).toContain("domesticMarketSplit.resolved.sellerCount > 0");
    expect(block).toContain("domesticMarketSplit.resolved.averagePriceKrw");
    expect(block, "🔴 exact 단독으로 되돌아가면 COMPARISON 가격이 다시 버려진다").not.toContain(
      "domesticMarketSplit.exact",
    );
  });

  /** 🟢 EXACT 가 있으면 **EXACT 가 이긴다**(COMPARISON 으로 덮지 않는다). */
  it("B-2 🟢 EXACT 가 있으면 EXACT 기준이다", () => {
    const split = summarizeDomesticMarketSplit([rec("a", 70000)], [rec("b", 88000)]);
    expect(split.basis).toBe("EXACT");
    expect(split.resolved.averagePriceKrw).toBe(70000);
  });

  /** 🔴🔴 CORE-2R-4 실측 모양 — EXACT 0 · COMPARISON 2 × 88,000. */
  it("B-3 🟢🟢 EXACT 0 이면 COMPARISON 이 국내 기준이 된다", () => {
    const split = summarizeDomesticMarketSplit([], [rec("a", 88000), rec("b", 88000)]);
    expect(split.basis).toBe("COMPARISON");
    expect(split.resolved.sellerCount).toBe(2);
    expect(split.resolved.averagePriceKrw).toBe(88000);
    /** 🔴 원가가 없으면 **UNKNOWN 이 정상** 이다(원가/마진 시스템을 만드는 일이 아니다). */
    expect(computeSellability({ costPriceKrw: null, domestic: { matched: true, averagePriceKrw: 88000 } }).level).toBe(
      "UNKNOWN",
    );
    /** 🟢 원가가 들어오면 **그 88,000 이 실제로 판단을 만든다**(이 WU 의 목적). */
    expect(
      computeSellability({ costPriceKrw: 40000, domestic: { matched: true, averagePriceKrw: 88000 } }).level,
    ).toBe("GREEN");
  });

  /** 🔴 국내 가격이 하나도 없으면 **여전히 UNKNOWN** 이다(없는 기준을 만들지 않는다). */
  it("B-4 🔴 국내 가격 0 이면 기준이 생기지 않는다", () => {
    const split = summarizeDomesticMarketSplit([], []);
    expect(split.basis).toBe("NONE");
    expect(split.resolved.sellerCount).toBe(0);
  });

  /** 🔴 **추천가/마진 축은 열지 않았다** — 그 둘은 여전히 EXACT 만 본다. */
  it("B-5 🔴 `computePriceDecision`/`computePriceRecommendation` 경로는 불변", () => {
    expect(MI_CODE).toContain('domesticBasis: domesticMarketSplit.basis');
    for (const banned of ["SAME_MIN_AXES", "crossSellerReserved", "PRESUMED_SAME"]) {
      expect(MI_CODE, `🔴 ${banned} 축이 이 파일에 들어왔다`).not.toContain(banned);
    }
  });
});

/* ═════════ C. 집계 — 최고가 칸은 «추가» 이고 기존 숫자를 안 바꾼다 ═════════ */

describe("CORE-2R-5 C — byCurrency 최고가(추가 칸)", () => {
  /**
   * 🔴🔴 **1차 fixture 가 변이를 놓쳤고 그것을 적는다.** 처음엔 `92000 → 83600` 순서로
   *    넣었는데, 그러면 **첫 레코드가 이미 최대** 라 갱신 줄을 지워도 통과한다(N5 가
   *    0 FAIL 이었다). 🟢 그래서 **오름차순** 으로 바꿔 「뒤에 온 더 큰 값을 집는가」를 문다.
   */
  it("C-1 🟢 최저/최고가 같은 루프에서 나온다 · 기존 칸 불변", () => {
    const s = summarizeCandidateOverseasPrices([
      { market: "KR", currency: "KRW", amount: 83600, priceTier: "COMPARISON" },
      { market: "KR", currency: "KRW", amount: 92000, priceTier: "COMPARISON" },
      { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON" },
    ]);
    expect(s.byCurrency.KRW).toEqual({ count: 3, lowestAmount: 83600, highestAmount: 92000 });
  });

  /** 🔴 `EXCLUDED` 는 금액 집계에서 **여전히 빠진다**(WU-062 계약 유지). */
  it("C-2 🔴 `EXCLUDED` 는 최고가에도 들어가지 않는다", () => {
    const s = summarizeCandidateOverseasPrices([
      { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON" },
      { market: "KR", currency: "KRW", amount: 999000, priceTier: "EXCLUDED" },
    ]);
    expect(s.byCurrency.KRW).toEqual({ count: 1, lowestAmount: 88000, highestAmount: 88000 });
    expect(s.byPriceTier.EXCLUDED).toBe(1);
  });
});

/* ══════ D. 🔴🔴 생산자를 늘릴 때 «읽는 쪽» 을 빠뜨리지 않는다 (CORE-2R-5 UI FIX) ══════ */

describe("CORE-2R-5 D — 다섯 출처가 전부 seller-facing rows 로 온다", () => {
  const PANEL = strip(readFileSync(join(COMMERCE, "DomesticPriceIntelligencePanel.tsx"), "utf8"));
  const SOURCES = [
    "geminiEvidence",
    "urlCandidateEvidence",
    "overseasAutoEvidence",
    "reviewedSameEvidence",
    "domesticListingEvidence",
  ] as const;

  /**
   * 🔴🔴 **CEO Production FAIL 의 원인이 정확히 이것이었다.** CORE-2R-4 가 다섯 번째
   *    출처를 만들어 MI 입력에는 넘겼는데 **패널이 그 칸을 읽지 않아** 국내 후보 둘
   *    (각 KRW 88,000)이 `rows` 에 한 번도 들어가지 못했다 ⟹ 🇰🇷 블록이
   *    「후보를 찾지 못했습니다」만 말했다.
   * 🟢 그래서 **다섯 자리를 전수로** 문다 — 숫자를 세지 않고 **이름마다** 단언한다.
   */
  it("D-1 🔴 자동 1회차 응답에서 다섯 배열을 **전부** state 로 읽는다", () => {
    for (const s of SOURCES) {
      expect(PANEL, `${s} 를 자동 1회차에서 읽지 않는다`).toContain(`j.domesticShop?.${s} ?? null`);
    }
  });

  it("D-2 🔴 「🔄 다시 분석」 응답에서도 다섯 배열을 **전부** 읽는다", () => {
    for (const s of SOURCES) {
      expect(PANEL, `${s} 를 다시 분석 경로에서 읽지 않는다`).toContain(`json.domesticShop?.${s} ?? null`);
    }
  });

  it("D-3 🔴 다섯 배열이 **전부** `rows` 로 합쳐지고 deps 에도 있다", () => {
    const at = PANEL.indexOf("const marketComparisonInput");
    expect(at).toBeGreaterThan(0);
    const block = PANEL.slice(at, PANEL.indexOf("onMarketComparisonChangeRef", at));
    for (const s of SOURCES) {
      expect(block, `${s} 가 rows 에 안 들어간다`).toContain(`...(${s} ?? [])`);
      expect(block, `${s} 가 「조회가 돌았는가」 판정에 안 들어간다`).toContain(`${s} != null`);
    }
  });
});
