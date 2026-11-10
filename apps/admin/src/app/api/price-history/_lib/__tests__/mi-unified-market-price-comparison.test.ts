import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  summarizeCandidateOverseasPrices,
  compareDomesticVsOverseasKrw,
  type CandidateOverseasPriceRecord,
} from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 — T1~T7 신규 계약
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 WU 가 고친 결함: **환산이 서버와 UI 두 곳에서 따로 일어났다.** UI 는
 * `convertToKrwStrict` 를 **환율 인자 없이** 불러 내장 고정표로 환산했고 서버는
 * 라이브 환율로 환산했다 ⟹ 같은 후보가 경로에 따라 다른 원화 숫자를 가질 수 있었고,
 * 그중 하나(`:2658`)는 **실제 판매가 확정**(`priceOverrideKrw`) 경로였다.
 *
 * 🔴 그래서 이 파일이 지키는 것은 **「표시 KRW == 확정 KRW」** 하나로 수렴한다.
 * 🔴 소스 단언은 **주석을 벗기고** 본다(이 저장소에서 아홉 번 걸린 함정).
 */
const HERE = __dirname;
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const INTEL = strip(readFileSync(path.join(HERE, "..", "market-intelligence.ts"), "utf8"));
const VIEW = strip(
  readFileSync(
    path.join(HERE, "..", "..", "..", "..", "pipeline", "commerce", "MarketPriceComparison.tsx"),
    "utf8",
  ),
);
const GUIDE = strip(
  readFileSync(
    path.join(HERE, "..", "..", "..", "..", "pipeline", "commerce", "mi-same-candidates.ts"),
    "utf8",
  ),
);

/** 🟢 자격 퍼널을 **통과하는** 최소 레코드(이 WU 가 자격 규칙을 바꾸지 않았다는 전제). */
const rec = (over: Partial<CandidateOverseasPriceRecord> = {}): CandidateOverseasPriceRecord => ({
  market: "OVERSEAS",
  currency: "GBP",
  amount: 37,
  priceTier: "COMPARISON",
  priceStatus: "VERIFIED_CURRENT",
  ...over,
});

describe("T1 🔵 환산 계약 — 파생값은 «주어진 것» 이고 지어내지 않는다", () => {
  it("T1-1 🟢 통화별 최저와 «통화를 넘은» 최저가 따로 산다", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ currency: "GBP", amount: 37, priceKrwDerived: 64_000 }),
      rec({ currency: "USD", amount: 58, priceKrwDerived: 80_000 }),
    ]);
    /** 🔴 통화별 집계는 **환산과 무관하게** 원본 금액 그대로다. */
    expect(s.byCurrency.GBP).toEqual({ count: 1, lowestAmount: 37, highestAmount: 37 });
    expect(s.byCurrency.USD).toEqual({ count: 1, lowestAmount: 58, highestAmount: 58 });
    /** 🟢 교차통화 최저는 **환산값으로** 고른다(GBP 가 더 싸다). */
    expect(s.lowestKrw).toEqual({ amountKrw: 64_000, currency: "GBP", amount: 37 });
  });

  it("T1-2 🔴🔴 환산 불가 후보를 **0 으로 취급하지 않는다**", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ currency: "TWD", amount: 2980, priceKrwDerived: null }),
      rec({ currency: "GBP", amount: 37, priceKrwDerived: 64_000 }),
    ]);
    /** 🔴 0 으로 봤다면 TWD 가 최저가 됐을 것이다. */
    expect(s.lowestKrw?.currency).toBe("GBP");
    /** 🟢 그래도 **후보는 사라지지 않는다** — 통화별 집계에는 그대로 있다. */
    expect(s.byCurrency.TWD).toEqual({ count: 1, lowestAmount: 2980, highestAmount: 2980 });
  });

  it("T1-3 🔴 환산값이 하나도 없으면 `null`(0 이 아니다)", () => {
    const s = summarizeCandidateOverseasPrices([rec({ priceKrwDerived: null })]);
    expect(s.lowestKrw).toBeNull();
  });

  it("T1-4 🔴 칸을 넘기지 않으면 동작이 바뀌지 않는다(하위호환)", () => {
    const s = summarizeCandidateOverseasPrices([rec()]);
    expect(s.lowestKrw).toBeNull();
    expect(s.byCurrency.GBP.lowestAmount).toBe(37);
  });
});

describe("T2 🔵 자격 퍼널 — 통과한 후보만 교차통화 최저에 든다", () => {
  it("T2-1 🔴 `EXCLUDED`(동일상품 아님)는 최저가가 되지 못한다", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ priceTier: "EXCLUDED", amount: 1, priceKrwDerived: 1_000 }),
      rec({ amount: 37, priceKrwDerived: 64_000 }),
    ]);
    expect(s.lowestKrw?.amountKrw).toBe(64_000);
  });

  it("T2-2 🔴 부적격 verdict(SIMILAR 등)도 최저가가 되지 못한다", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ verdict: "SIMILAR", amount: 1, priceKrwDerived: 1_000 }),
      rec({ verdict: "SAME", amount: 37, priceKrwDerived: 64_000 }),
    ]);
    expect(s.lowestKrw?.amountKrw).toBe(64_000);
  });

  it("T2-3 🔴 «가격 미확인» 도 최저가가 되지 못한다", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ priceStatus: "UNVERIFIED_SEARCH", amount: 1, priceKrwDerived: 1_000 }),
      rec({ amount: 37, priceKrwDerived: 64_000 }),
    ]);
    expect(s.lowestKrw?.amountKrw).toBe(64_000);
    expect(s.unverifiedCount).toBe(1);
  });

  it("T2-4 🔴 «관측된 차이»(가격 부적격 blocker)도 최저가가 되지 못한다", () => {
    /**
     * 🔴🔴 **내 1차 단언이 틀렸고 코드가 맞았다.** `COLOR` 를 가격 부적격으로 썼는데
     *    그 집합(`PRICE_DISQUALIFYING_BLOCKER_LIST`)에 **없다** — 그 정책은
     *    `BRAND_MISMATCH`·`NO_TITLE_OVERLAP`·`SAME_SELLER_DISTINCT_LISTING` 를 담고
     *    표기·정규화 축(`COLOR`·`MATERIAL`·`FIT`)은 **의도적으로 뺀다**.
     * 🟢 그래서 **실제 집합의 원소** 로 단언한다 — 정책을 내가 지어내지 않는다.
     * 🔴 집합 자체는 **한 글자도 바꾸지 않았다**(이 WU 범위 밖이다).
     */
    const s = summarizeCandidateOverseasPrices([
      rec({ blockers: ["BRAND_MISMATCH"], amount: 1, priceKrwDerived: 1_000 }),
      rec({ amount: 37, priceKrwDerived: 64_000 }),
    ]);
    expect(s.lowestKrw?.amountKrw).toBe(64_000);
    expect(s.observedDifferenceCount).toBe(1);
  });
});

describe("T3 🔵🔵 UI 는 환산하지 않는다 — 표시 KRW == 확정 KRW", () => {
  it("T3-1 🔴🔴 `MarketPriceComparison.tsx` 전체에서 환산 호출이 **0건**", () => {
    /** 🔴 좌표로 세지 않는다(구현하면서 밀린다) — **파일 전체** 를 본다. */
    expect(VIEW).not.toContain("convertToKrwStrict(");
    /** 🔴 import 도 없다 — 들여오면 환산 owner 가 둘이 된다. */
    expect(VIEW).not.toMatch(/import[\s\S]{0,200}convertToKrwStrict/);
  });

  it("T3-2 🔴 환율표를 직접 들지 않고 손으로 곱하지도 않는다", () => {
    expect(VIEW).not.toContain("FIXED_RATES_TO_KRW");
    expect(VIEW).not.toMatch(/priceAmount\s*\*\s*\d/);
  });

  it("T3-3 🔴🔴 표시와 확정이 **같은 읽기 함수** 를 쓴다", () => {
    /**
     * 🔴 이것이 이 WU 의 핵심 계약이다 — 전에는 표시(`:2486`)와 확정(`:2658`)이
     *    **각각** 환산해서 갈릴 수 있었다. 이제 둘 다 `derivedKrwOf(row)` 를 읽는다.
     */
    const calls = VIEW.match(/derivedKrwOf\(row\)/g) ?? [];
    expect(calls.length, "🔴 표시·확정 둘 중 하나가 다른 경로를 쓴다").toBeGreaterThanOrEqual(2);
    /** 🔴 그 함수가 `undefined` 를 `null` 로 닫는다(숫자를 지어낼 자리 차단). */
    expect(VIEW).toContain("row.priceKrwDerived ?? null");
  });

  it("T3-4 🔴 1차 요약도 **서버 파생값** 을 읽는다(자체 환산 금지)", () => {
    expect(VIEW).toContain("c.lowestKrw");
  });

  it("T3-5 🔴 `buildPriceGuide` 는 **고르기만** 한다 — 환산 0", () => {
    expect(GUIDE).not.toContain("convertToKrwStrict");
    expect(GUIDE).toContain("priceKrwDerived");
  });
});

describe("T4 🔵 POST/GET — 두 경로가 «같은» 환율을 쓴다", () => {
  it("T4-1 🔴🔴 환율 조회가 후보 evidence 생산 **앞** 이다", () => {
    const rates = INTEL.indexOf("await fetchLiveExchangeRates()");
    const produce = INTEL.indexOf("savedCandidateRowsToEvidence(savedCandidateRows)");
    expect(rates, "🔴 환율 조회가 없다").toBeGreaterThan(-1);
    expect(produce, "🔴 GET 복원 생산 지점이 없다").toBeGreaterThan(-1);
    /**
     * 🔴 뒤에 있으면 **GET 복원 후보가 환율을 못 본다**(이 WU 가 고친 결함).
     */
    expect(rates, "🔴 환율 조회가 후보 생산보다 뒤에 있다").toBeLessThan(produce);
  });

  it("T4-2 🔴 환율 조회는 **1회** 다", () => {
    const calls = INTEL.match(/fetchLiveExchangeRates\(\)/g) ?? [];
    expect(calls.length, "🔴 두 번 받으면 두 숫자가 다른 환율 위에 선다").toBe(1);
  });

  it("T4-3 🔴🔴 비용 경로의 `liveRates` 는 **가드 안에서만** 세팅된다(원가 축 불변)", () => {
    /**
     * 🔴 무조건 세팅하면 `computePriceBreakdown` 의 입력이 바뀌어 **원가·수익성이 변한다**.
     *    그래서 가드는 그대로 두고 **재조회만** 없앴다.
     */
    expect(INTEL).toContain("if (canComputeCost && shippingKrw != null) {");
    const guardAt = INTEL.indexOf("if (canComputeCost && shippingKrw != null) {");
    const assignAt = INTEL.indexOf("liveRates = exchangeRates.rates;");
    expect(assignAt, "🔴 liveRates 가 가드 밖에서 세팅된다").toBeGreaterThan(guardAt);
  });

  it("T4-4 🔴 POST·GET **두 응답 배열 모두** 파생값을 받는다", () => {
    expect(INTEL).toContain("geminiEvidence: attachDerivedKrw(geminiEvidence, candidateKrwByUrl)");
    expect(INTEL).toContain(
      "savedCandidateRows: attachDerivedKrw(savedCandidateRows, candidateKrwByUrl)",
    );
    /** 🔴 `null`(안 돌았다) 과 `[]`(후보 0) 을 섞지 않는다. */
    expect(INTEL).toContain("if (!rows) return null;");
  });
});

describe("T5 🔵🔵 ⑥ 국내 대비 해외 KRW 차이", () => {
  const lowest = { amountKrw: 64_000, currency: "GBP", amount: 37 };

  it("T5-1 🟢 같은 KRW 기준으로 차이를 낸다", () => {
    const c = compareDomesticVsOverseasKrw(88_000, lowest);
    expect(c).toEqual({
      domesticKrw: 88_000,
      overseasKrw: 64_000,
      overseasCurrency: "GBP",
      overseasAmount: 37,
      differenceKrw: 24_000,
    });
  });

  it("T5-2 🔴🔴 국내 기준값이 없으면 `null`(0원 차이가 아니다)", () => {
    expect(compareDomesticVsOverseasKrw(null, lowest)).toBeNull();
    expect(compareDomesticVsOverseasKrw(undefined, lowest)).toBeNull();
    expect(compareDomesticVsOverseasKrw(0, lowest)).toBeNull();
  });

  it("T5-3 🔴🔴 해외 적격 후보가 없으면 `null`", () => {
    expect(compareDomesticVsOverseasKrw(88_000, null)).toBeNull();
  });

  it("T5-4 🟢 원본 통화·금액을 **보존** 한다(추적 가능성)", () => {
    const c = compareDomesticVsOverseasKrw(88_000, lowest);
    expect(c?.overseasCurrency).toBe("GBP");
    expect(c?.overseasAmount).toBe(37);
  });

  it("T5-5 🟢 국내가 더 싸면 차이가 **음수** 다(부호를 뭉개지 않는다)", () => {
    const c = compareDomesticVsOverseasKrw(50_000, lowest);
    expect(c?.differenceKrw).toBe(-14_000);
  });

  it("T5-6 🔴 비율을 만들지 않는다 — 칸은 다섯뿐", () => {
    const c = compareDomesticVsOverseasKrw(88_000, lowest)!;
    expect(Object.keys(c).sort()).toEqual(
      [
        "domesticKrw",
        "overseasKrw",
        "overseasCurrency",
        "overseasAmount",
        "differenceKrw",
      ].sort(),
    );
  });
});

describe("T6 🔵 기존 정책 불변 — 이 WU 는 판정을 바꾸지 않는다", () => {
  it("T6-1 🔴 ⑥ 은 **파생 정보** 다 — 판정/추천/알림이 읽지 않는다", () => {
    /**
     * ════════════════════════════════════════════════════════════════════════
     * 🔵🔵🔵 MI-SELLER-MARKET-COMPARISON-A — **T6-1 개편**(CPO 승인)
     * ════════════════════════════════════════════════════════════════════════
     *
     * 🔴🔴 **1차 단언이 화면 연결을 막고 있었다.** 「`marketKrwComparison` 이 소스에
     *    **정확히 1회** 등장한다」로 썼는데, 그러면 **화면이 그 값을 읽는 순간 FAIL** 한다.
     *    내가 지키려던 것은 「등장 횟수」가 아니라 **「판정 owner 가 읽지 않는다」** 였다.
     * 🟢 그래서 축을 **그 의미로** 바꾼다 — 등장 수를 세지 않고 **누가 읽는지** 를 본다.
     *    🔴 약화가 아니다: 판정 입력으로 흘러가면 **여전히 FAIL** 한다(아래 두 단언).
     */
    for (const owner of [
      "sellerAction",
      "computePriceRecommendation",
      "computeReferenceProfitability",
      "computeSellability",
      "computeMarketAlert",
      "toSellerFacingVerdict",
    ]) {
      expect(INTEL, `🔴 ⑥ 값이 ${owner} 입력으로 흘러갔다`).not.toMatch(
        new RegExp(`${owner}[^\\n]*marketKrwComparison`),
      );
      expect(INTEL, `🔴 ${owner} 가 ⑥ 값을 읽는다`).not.toMatch(
        new RegExp(`marketKrwComparison[^\\n]*${owner}`),
      );
    }
    /** 🟢 생산은 **반환부 한 곳** 이다(계산 owner 를 둘로 만들지 않는다). */
    expect(INTEL).toContain("marketKrwComparison: compareDomesticVsOverseasKrw(");
  });

  it("T6-1-b 🟢🟢 ⑥ 이 **실제 렌더 화면까지** 도달한다 (소비 검증)", () => {
    /**
     * 🔴🔴 이 WU 가 세 번 실패한 지점이 **바로 이것** 이다 — 서버가 값을 만들어도
     *    화면이 읽지 않으면 셀러에게는 **없는 것** 이다. 그래서 경로 전체를 단언한다.
     * 🔴 `MiPanelView` 는 **운영에서 마운트되지 않는다** ⟹ 그쪽으로 가면 안 된다.
     */
    const ROUTE = strip(
      readFileSync(path.join(HERE, "..", "..", "check", "route.ts"), "utf8"),
    );
    const PANEL = strip(
      readFileSync(
        path.join(HERE, "..", "..", "..", "..", "pipeline", "commerce", "DomesticPriceIntelligencePanel.tsx"),
        "utf8",
      ),
    );
    const WORKSPACE = strip(
      readFileSync(path.join(HERE, "..", "..", "..", "..", "pipeline", "CommerceWorkspace.tsx"), "utf8"),
    );
    const VIEW = strip(
      readFileSync(
        path.join(HERE, "..", "..", "..", "..", "pipeline", "commerce", "MarketPriceComparison.tsx"),
        "utf8",
      ),
    );
    const SUMMARY = strip(
      readFileSync(
        path.join(HERE, "..", "..", "..", "..", "pipeline", "commerce", "judgement-summary.ts"),
        "utf8",
      ),
    );

    /** ① 응답 */
    expect(ROUTE, "🔴 API 응답에 실리지 않는다").toContain(
      "marketKrwComparison: intelligence?.marketKrwComparison ?? null",
    );
    /** ② Panel state — 🔴 **GET·POST 둘 다**(한쪽만이면 재분석에서 사라진다) */
    expect(
      (PANEL.match(/setMarketKrwComparison\(/g) ?? []).length,
      "🔴 GET·POST 두 경로가 아니다",
    ).toBeGreaterThanOrEqual(2);
    /** ③ Panel → payload(+deps) */
    expect(PANEL, "🔴 payload 에 실리지 않는다").toContain("marketKrwComparison,");
    /** ④ Workspace → 실제 마운트 컴포넌트 */
    expect(WORKSPACE, "🔴 마운트 지점에 전달되지 않는다").toContain(
      "marketKrwComparison={marketComparison?.marketKrwComparison ?? null}",
    );
    /** ⑤ 🟢 **화면이 실제로 그린다** — 국내 가격 · 해외 가격 · 자격 범위 문구 */
    for (const id of [
      "market-krw-comparison",
      "market-krw-comparison-domestic",
      "market-krw-comparison-overseas",
      "market-krw-comparison-scope",
    ]) {
      expect(VIEW, `🔴 화면에 ${id} 가 없다`).toContain(`data-testid="${id}"`);
    }
    /**
     * ⑤-b 🔴🔴 **차액은 그리지 않는다** (CPO 전략 정정 2026-11-10)
     *
     * 🔴 1차에 「국내 − 해외 차이」를 그렸고 그 testid 를 **요구** 하는 계약을 썼다.
     *    CPO 가 그 방향을 철회했다 — 「차액으로 셀러의 **판매 결정을 유도** 하지 않는다.
     *    가격은 정확히 제공하고 **판매 판단은 MI** 가 한다.」
     * 🟢 그래서 단언을 **반대로** 세운다 — 다시 그리면 **FAIL** 한다.
     * 🔴 금지 축은 셋이다: 전용 testid · 차액 어휘 · 화면에서의 뺄셈.
     */
    expect(VIEW, "🔴 차액 줄이 되살아났다").not.toContain(
      'data-testid="market-krw-comparison-diff"',
    );
    expect(VIEW, "🔴 차액 어휘가 되살아났다").not.toMatch(/COMPARE_DIFF_/);
    /**
     * 🔴 **타입 선언은 남는다** — prop 계약의 칸이고 서버가 그 값을 보낸다.
     *    그래서 「`differenceKrw` 라는 글자가 없다」로 쓰면 **선언까지 잡는다**(1차에 FAIL).
     * 🟢 막아야 할 것은 **그 값을 «읽어서 화면에 쓰는 것»** 이다 ⟹ 사용 형태로 좁힌다.
     */
    expect(VIEW, "🔴 화면이 차액 값을 읽는다").not.toMatch(
      /marketKrwComparison\.differenceKrw/,
    );
    /** ⑥ 🔴 **요약 카드로 가지 않는다**(WU-141-R3 — 그 카드는 가격 owner 가 아니다) */
    expect(SUMMARY, "🔴 요약 카드가 가격 비교를 읽는다").not.toMatch(
      /marketKrwComparison\??:/,
    );
    /** ⑦ 🔴 화면이 **스스로 계산하지 않는다** — 차액·환산을 만들지 않는다 */
    expect(VIEW).not.toMatch(/domesticKrw\s*-\s*overseasKrw/);
    expect(VIEW).not.toContain("convertToKrwStrict(");
  });

  it("T6-2 🔴 `byCurrency` 버킷에 환산을 섞지 않았다", () => {
    const s = summarizeCandidateOverseasPrices([rec({ priceKrwDerived: 64_000 })]);
    expect(Object.keys(s.byCurrency.GBP).sort()).toEqual(
      ["count", "highestAmount", "lowestAmount"].sort(),
    );
  });

  it("T6-3 🔴 환산값을 동일상품 판정 근거로 쓰지 않는다", () => {
    /** 🔴 matcher/tier 어휘와 파생 칸이 **같은 줄에** 서지 않는다. */
    expect(INTEL).not.toMatch(/priceKrwDerived[^\n]*(matchTruth|crossSellerVerdict|priceTier)/);
    expect(INTEL).not.toMatch(/(matchTruth|crossSellerVerdict)[^\n]*priceKrwDerived/);
  });
});

describe("T7 🔵 환산 owner 는 «서버 한 곳» 이다", () => {
  it("T7-1 🔴 라이브 환율을 **넘긴다**(인자 없이 부르면 내장 고정표다)", () => {
    expect(INTEL).toContain(
      "convertToKrwStrict(e.priceAmount, e.priceCurrency, candidateRates)",
    );
  });

  it("T7-2 🔴 환산 실패는 `null` 이고 0 이 아니다", () => {
    expect(INTEL).toContain("priceKrwDerived: derived?.amountKrw ?? null");
  });

  it("T7-3 🔴 원본 가격·통화를 **덮지 않는다**(가산이다)", () => {
    expect(INTEL).toMatch(/\.\.\.r,\s*priceKrwDerived:/);
  });
});
