import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeMarketAlert, computeSellerAction, priceLevelFromVerdict } from "@commerce/pricing";
import { summarizeCandidateOverseasPrices } from "../candidate-market";
import {
  DOMESTIC_REFERENCE_NOTE,
  DOMESTIC_REFERENCE_SCOPE,
  DOMESTIC_REFERENCE_TITLE,
  OVERSEAS_REFERENCE_SCOPE,
  OVERSEAS_REFERENCE_TITLE,
} from "../../../../pipeline/commerce/overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-061 — **가격 증거 / 비교 경계 닫기** (측정 + 계약 · 운영 동작 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── ① 국내 가격 증거 회수율 (운영 owner 로 재현 · HTTP 0 · 캐시 HTML) ──────
 * 국내/한국계 후보 **13건** (`.kr` 6 + kihanan/mustit/trenbe 등 한국계 7)
 * ```
 * 회수 **11/13** — 전부 **① JSON-LD** 로 회수됐다
 *   ② microdata 로만 가능      **0건**
 *   ③ meta(og/product:price)로만 가능  **0건**   ← 🔴 3층을 구현해도 **증분 0**
 *   🔴 실패 **2건** — 둘 다 `beaumonde.co.kr` (ld 0 · micro 0 · meta 0)
 * 통화: KRW **7건**(국내 축 자격) · USD 3 · JPY 1
 * ```
 *
 * ── ② 🔴🔴 계층이 «일관되지 않다» — 1건에서 두 층이 다른 가격을 말한다 ────
 * ```
 * C15 m.web.mustit.co.kr   ①JSON-LD **226,000 KRW**  ↔  ③meta **233,000 KRW**
 * 나머지 11건은 일치. ⟹ 불일치율 **1/12 = 8.3%**
 * ```
 * 🔴 그래서 **3층을 추가하지 않는 것이 맞다** — 증분 회수가 **0** 인데 fallback 순서에
 *    따라 **7,000원 차이** 가 생긴다. 🔴 어느 쪽이 진짜 판매가인지 CTO 는 확인할 수 없다
 *    (mustit 은 리세일 플랫폼이라 「즉시구매가 ↔ 최저가」가 공존할 수 있다 — **미확인**).
 *
 * ── ③ `EXCLUDED` 집계 영향도 (숫자 전후) ───────────────────────────────────
 * GT 51 tier 분포 `EXACT 12 · COMPARISON 29 · REFERENCE 2 · EXCLUDED **8(15.7%)**`
 * 집계기에 같은 입력을 두 번 넣어 직접 비교했다 — 아래 테스트가 그 숫자다.
 *
 * ── ④ transient → persistent alert 경계 ────────────────────────────────────
 * 🟢 **transient 만 있는 상태에서 알림이 생성되지 않는다** — 소스 grep 이 아니라
 *    `computeSellerAction` + `computeMarketAlert` 를 **직접 불러** 단언한다.
 */

/* ════════ ② 가격 증거 계층 — 3층을 추가하지 않는다 ════════ */

describe("② 가격 증거 우선순위", () => {
  /**
   * 🔴 후보 경로는 **두 층** 만 본다. OpenGraph 층(`extractFromOpenGraph`)은 리포에
   *    존재하지만 **원상품 경로 전용** 이고, 후보 경로에 넣으면 §② 불일치가 들어온다.
   */
  it("🔴 후보 가격 경로가 JSON-LD → microdata 둘뿐이다 (meta 층 미사용)", () => {
    const src = readFileSync(
      path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/product-url-facts.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toContain("const priced = priceFromJsonLd(html) ?? micro?.price ?? null");
    /** 🔴 OpenGraph 를 후보 경로에 끌어오지 않는다. */
    expect(src).not.toContain("extractFromOpenGraph");
    /** 🔴 generic body 숫자 파서를 만들지 않는다(CPO 금지). */
    expect(src).not.toMatch(/원\s*['"`]/);
    expect(src).not.toContain("fixedPrice");
  });

  /** 🔴 가격 신뢰도 owner 는 하나다 — `priceSource === "detail"` 하나로만 승격된다. */
  it("🟢 priceSource detail ⟹ VERIFIED_CURRENT 계약이 그대로다", () => {
    const facts = readFileSync(
      path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/product-url-facts.ts"),
      "utf8",
    );
    expect(facts).toContain('priceSource: priced ? "detail" : null');
    expect(facts).toContain('priceStatus: priced ? "VERIFIED_CURRENT" : "PRICE_UNAVAILABLE"');
  });
});

/* ════════ ③ 국내/해외 의미 분리 + EXCLUDED 영향도 ════════ */

describe("③ 의미 분리", () => {
  /** 🔴 다섯 어휘가 서로 섞이지 않는다 — 제목 상호 비포함(WU-056-R1 확장). */
  it("🔴 다섯 가격 어휘가 상호 비포함이다", () => {
    const names = [OVERSEAS_REFERENCE_TITLE, DOMESTIC_REFERENCE_TITLE, "원본 상품", "동일상품 아님", "가격 미확인"];
    for (const a of names)
      for (const b of names) {
        if (a === b) continue;
        expect(a.includes(b), `「${a}」가 「${b}」를 포함한다`).toBe(false);
      }
  });

  /**
   * 🔴 두 구역의 «범위 문구» 가 서로 다른 사실을 말한다 — 섞으면 한쪽이 거짓이 된다.
   *    해외: 판매판정 미반영(사실) · 국내: 저장 안 됨(사실) · 🔴 국내에 「판매판정」을 쓰지 않는다.
   */
  it("🔴 범위 문구가 축마다 다르다", () => {
    expect(OVERSEAS_REFERENCE_SCOPE).toContain("판매판정");
    expect(DOMESTIC_REFERENCE_SCOPE).not.toContain("판매판정");
    expect(DOMESTIC_REFERENCE_SCOPE).toContain("저장되지 않습니다");
    expect(DOMESTIC_REFERENCE_NOTE).toContain("원래 통화");
  });

  /**
   * 🔴🔴 **영향도 — 숫자 전후.** 집계기가 tier 를 필터하지 않으므로
   *    「동일상품 아님」(`EXCLUDED`) 후보가 **최저가** 를 만든다.
   * 🔴 이 테스트는 **현행 숫자를 고정** 한다(CPO: 임의 필터링 금지). 바꾸려면 여기가 깨진다.
   */
  it("🔴 EXCLUDED 가 최저가를 만든다 — 전후 숫자를 고정한다", () => {
    const recs = [
      { market: "OVERSEAS", currency: "EUR", amount: 40, priceTier: "EXACT" },
      { market: "OVERSEAS", currency: "EUR", amount: 75, priceTier: "COMPARISON" },
      { market: "OVERSEAS", currency: "EUR", amount: 9, priceTier: "EXCLUDED" },
      { market: "OVERSEAS", currency: "USD", amount: 98, priceTier: "REFERENCE" },
      { market: "OVERSEAS", currency: "USD", amount: 12, priceTier: "EXCLUDED" },
    ];
    const before = summarizeCandidateOverseasPrices(recs as never);
    const after = summarizeCandidateOverseasPrices(recs.filter((r) => r.priceTier !== "EXCLUDED") as never);

    /** 전(현행) */
    expect(before.byCurrency.EUR).toEqual({ count: 3, lowestAmount: 9 });
    expect(before.byCurrency.USD).toEqual({ count: 2, lowestAmount: 12 });
    expect(before.byPriceTier.EXCLUDED).toBe(2);
    /** 후(최소 수정안 — EXCLUDED 제외) */
    expect(after.byCurrency.EUR).toEqual({ count: 2, lowestAmount: 40 });
    expect(after.byCurrency.USD).toEqual({ count: 1, lowestAmount: 98 });
    /** 🔴 **차이가 작지 않다** — EUR 9→40(4.4배) · USD 12→98(8.2배) */
    expect(after.byCurrency.EUR.lowestAmount / before.byCurrency.EUR.lowestAmount).toBeGreaterThan(4);
  });

  /** 🟢 국내 축은 적재 시점에 이미 두 tier 뿐이라 같은 문제가 없다(비대칭의 다른 쪽). */
  it("🟢 국내 적재 조건이 EXACT/COMPARISON 둘뿐이다", () => {
    const src = readFileSync(path.join(__dirname, "..", "market-intelligence.ts"), "utf8");
    const i = src.indexOf("domesticTransientRecords.push(");
    const guard = src.slice(src.lastIndexOf("if (", i), i);
    expect(guard).toContain('e.priceTier === "EXACT"');
    expect(guard).toContain('e.priceTier === "COMPARISON"');
    expect(guard).not.toContain("EXCLUDED");
  });
});

/* ════════ ④ transient → persistent alert 경계 ════════ */

describe("④ 알림 경계 — 운영 함수를 직접 부른다", () => {
  /**
   * 🔴🔴 **소스 grep 이 아니라 함수를 부른다.** 「transient 후보만 있는 상태」를
   *    운영 입력 모양으로 만들어 알림이 **생성되지 않음** 을 단언한다.
   *
   * transient 가 만드는 상태:
   *   국내 EXACT 0  ⟹ `decision` 없음 ⟹ priceLevel **UNKNOWN** ⟹ status INSUFFICIENT_DATA
   *   추세          ⟹ DB 전용이라 **null**
   *   품절          ⟹ transient 는 `soldOut: null` 이라 **0**
   *   해외 원가 변화 ⟹ 이번 확인만으로는 **null**
   */
  it("🟢 transient 만 있으면 알림이 null 이다", () => {
    const sellerAction = computeSellerAction({
      priceLevel: priceLevelFromVerdict(null),
      currentSellingPriceKrw: null,
      domestic: {
        /** 🔴 transient COMPARISON 가격이 집계에 **들어와 있어도** 판정 등급은 EXACT 전용이다. */
        lowestPriceKrw: 117_000,
        averagePriceKrw: 150_000,
        sellerCount: 3,
        priceGapVsLowestPercent: null,
        priceGapVsAveragePercent: null,
        trend: null,
        soldOutCount: 0,
      },
      origin: { change: null },
    });
    expect(sellerAction.status).toBe("INSUFFICIENT_DATA");
    expect(sellerAction.opportunity).toBeNull();
    const alert = computeMarketAlert({ sellerAction, domesticChange: null, originChange: null });
    /** 🟢 **행이 만들어지지 않는다** — 그래서 transient 가 영속 알림을 낳지 않는다. */
    expect(alert).toBeNull();
  });

  /**
   * 🔴 그리고 **어디서 열리는지** 를 고정한다 — `priceLevel` 이 올라가는 순간이다.
   *    국내 EXACT 가 생기면(CF-3 승인 등) 이 경로가 **열린다**. 그 결합을 기록해 둔다.
   */
  it("🔴 priceLevel 이 올라가면 알림 행이 생긴다 (결합 지점)", () => {
    const sellerAction = computeSellerAction({
      /** 🔴 어휘를 지어내지 않는다 — `PriceDecisionVerdict` 는 MAINTAIN|CONSIDER_LOWER|**MARGIN_RISK** 셋이다. */
      priceLevel: priceLevelFromVerdict("MARGIN_RISK"),
      currentSellingPriceKrw: 200_000,
      domestic: {
        lowestPriceKrw: 117_000,
        averagePriceKrw: 150_000,
        sellerCount: 3,
        priceGapVsLowestPercent: 70,
        priceGapVsAveragePercent: 33,
        trend: null,
        soldOutCount: 0,
      },
      origin: { change: null },
    });
    expect(sellerAction.status).toBe("PRICE_ADJUST");
    const alert = computeMarketAlert({ sellerAction, domesticChange: null, originChange: null });
    expect(alert?.severity).toBe("ACTION_REQUIRED");
  });

  /** 🟢 품절 신호도 transient 로는 발화하지 않는다 — `soldOut: null` 이라 0 이다. */
  it("🟢 transient 는 품절 기회 신호를 만들지 못한다", () => {
    const src = readFileSync(path.join(__dirname, "..", "market-intelligence.ts"), "utf8");
    const i = src.indexOf("const transient: PriceObservationRecord = {");
    expect(i).toBeGreaterThan(0);
    const block = src.slice(i, src.indexOf("};", i));
    expect(block).toContain("soldOut: null");
    expect(block).toContain("marketCode: null");
    expect(block).toContain('currency: "KRW"');
  });
});
