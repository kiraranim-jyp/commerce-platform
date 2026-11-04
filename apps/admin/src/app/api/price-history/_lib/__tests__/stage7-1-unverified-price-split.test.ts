import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../candidate-market";
import { buildOverseasReference } from "../../../../pipeline/commerce/overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 7-1 — **UNVERIFIED 가격을 «확인가» 집계에서 분리한다**(CPO 실행 우선순위 1)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO ④ 원문: 「UNVERIFIED 가격을 VERIFIED 가격 집계에 섞지 않는다.
 *    판매처 및 후보 정보는 **보존** 한다.」
 * 🔴 CPO 실행 원칙: 「**1번과 2번은 별개 작업이므로 하나의 변경으로 뭉개지 않는다**」
 *    ⟹ 🟢 이 파일은 **가격 신뢰도 축 하나만** 잠근다. 노출 등급 ↔ 가격 자격 분리(2번)는
 *       별 파일이다(verdict 축은 SPRINT 3 P1 이 이미 잠갔다).
 *
 * ── 🔴 실측이 이 변경의 근거다(FINAL-MARKET-COMPARISON-REVIEW §7~§9) ──────────
 * ```
 * 스냅샷 6cf3e50e(11-03 · B226AC073) — 화면이 낸 값
 *   🌎 CAD 370 ~ 19,100  (**51배** · 그 안에 「Diesel Viker Jeans」= 다른 브랜드)
 *   🌎 USD 22,200        (통화 오인 의심)
 *   7건 중 **6건이 UNVERIFIED_SEARCH** 이고, 유일한 VERIFIED(junioredition GBP 75)가
 *   **유일하게 원상품과 제목이 일치** 했다
 * ```
 *
 * 🔴 이 파일이 **지키는 것 넷**:
 * ```
 * ① 후보는 하나도 사라지지 않는다 — count·byMarket·byPriceTier 불변(WU-062 선례)
 * ② null 은 막지 않는다 — 낡은 저장분 artifact 다(derivePriceStatus 는 null 을 못 낸다)
 * ③ 금액을 「미확인」 줄에 합치지 않는다 — 범위를 만들지 않는다
 * ④ priceStatus 를 안 넘기면 **동작이 한 글자도 바뀌지 않는다**(하위호환)
 * ```
 */

const rec = (o: Partial<CandidateOverseasPriceRecord>): CandidateOverseasPriceRecord => ({
  market: "OVERSEAS",
  currency: "GBP",
  amount: 37,
  priceTier: "EXACT",
  ...o,
});

describe("STAGE 7-1 — A. 금액 집계에서 «미확인» 을 가른다", () => {
  it("A-1 🔴 UNVERIFIED_SEARCH 금액은 byCurrency 에 «들어가지 않는다»", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ amount: 75, priceStatus: "VERIFIED_CURRENT" }),
      rec({ amount: 21.2, priceStatus: "UNVERIFIED_SEARCH" }),
    ]);
    /** 🔴 CPO ① — 21.2 와 75 를 **한 범위로 합치지 않는다**. */
    expect(s.byCurrency.GBP).toEqual({ count: 1, lowestAmount: 75, highestAmount: 75 });
    expect(s.unverifiedCount).toBe(1);
  });

  it("A-2 🟢 관측은 지우지 않는다 — count·byMarket·byPriceTier 는 **전건을 센다**(WU-062 선례)", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ amount: 75, priceStatus: "VERIFIED_CURRENT" }),
      rec({ amount: 21.2, priceStatus: "UNVERIFIED_SEARCH" }),
      rec({ amount: 19100, currency: "CAD", priceStatus: "UNVERIFIED_SEARCH" }),
    ]);
    expect(s.count).toBe(3);
    expect(s.byMarket.OVERSEAS).toBe(3);
    expect(s.byPriceTier.EXACT).toBe(3);
    /** 🔴🔴 그리고 **통화 축 자체가 사라진다** — CAD 는 확인가가 0 이므로 칸이 없다. */
    expect(s.byCurrency.CAD).toBeUndefined();
  });

  it("A-3 🔴🔴 `null` 은 **막지 않는다** — 낡은 저장분 artifact 다", () => {
    /**
     * 🔴 `derivePriceStatus`(match.ts:568)는 VERIFIED_CURRENT / UNVERIFIED_SEARCH
     *    **둘만** 낸다 ⟹ `null` 은 판정 산출이 아니라 **저장 시점의 공백** 이다.
     *    DB 실측 경계 — `10-20~11-01 null 104` → `11-02~03 null 0 · 채워짐 37`.
     * 🔴 막으면 기존 후보(국내 유일 가격 KRW 88,000 포함)가 **조용히 사라진다**.
     */
    const s = summarizeCandidateOverseasPrices([
      rec({ currency: "KRW", amount: 88000, priceStatus: null }),
    ]);
    expect(s.byCurrency.KRW.lowestAmount).toBe(88000);
    expect(s.unverifiedCount).toBe(0);
  });

  it("A-4 🟢 `priceStatus` 를 안 넘기면 **동작이 한 글자도 바뀌지 않는다**(하위호환)", () => {
    const s = summarizeCandidateOverseasPrices([rec({ amount: 21.2 }), rec({ amount: 37 })]);
    expect(s.byCurrency.GBP).toEqual({ count: 2, lowestAmount: 21.2, highestAmount: 37 });
    expect(s.unverifiedCount).toBe(0);
  });

  it("A-5 🔴 `unverifiedCount` 의 의미를 좁게 고정한다 — EXCLUDED·부적격 verdict·금액 없음은 «들어가지 않는다»", () => {
    /**
     * 🔴 순서가 의미다. `priceStatus` 검사가 EXCLUDED·verdict·금액 유무 **뒤** 이므로
     *    이 수는 **「자격도 금액도 있는데 확인만 안 된」** 것 하나를 가리킨다.
     *    (순서를 올리면 「동일상품 아님」까지 「미확인」으로 세어 화면이 거짓을 말한다)
     */
    const s = summarizeCandidateOverseasPrices([
      rec({ priceTier: "EXCLUDED", priceStatus: "UNVERIFIED_SEARCH" }),
      rec({ verdict: "SIMILAR", priceStatus: "UNVERIFIED_SEARCH" }),
      rec({ amount: null, priceStatus: "UNVERIFIED_SEARCH" }),
      rec({ amount: 21.2, priceStatus: "UNVERIFIED_SEARCH" }),
    ]);
    expect(s.unverifiedCount).toBe(1);
    expect(s.byCurrency.GBP).toBeUndefined();
  });

  it("A-6 🟢 판매처 접힘(sellerKey)과 같이 써도 확인가만 접힌다", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ currency: "KRW", amount: 88000, sellerKey: "a.kr", priceStatus: "VERIFIED_CURRENT" }),
      rec({ currency: "KRW", amount: 1000, sellerKey: "a.kr", priceStatus: "UNVERIFIED_SEARCH" }),
    ]);
    /** 🔴 미확인 1,000 이 그 판매처의 「최저 확인가」가 되지 않는다. */
    expect(s.byCurrency.KRW).toEqual({ count: 1, lowestAmount: 88000, highestAmount: 88000 });
    expect(s.unverifiedCount).toBe(1);
  });
});

describe("STAGE 7-1 — B. 화면이 «왜 줄었는지» 를 말한다(후보를 숨긴 것이 아니다)", () => {
  it("B-1 🔴 「미확인 N곳」 한 줄이 선다 — 🔴 그 줄에 **금액이 없다**", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ amount: 75, priceStatus: "VERIFIED_CURRENT" }),
      rec({ amount: 21.2, priceStatus: "UNVERIFIED_SEARCH" }),
      rec({ amount: 19100, currency: "CAD", priceStatus: "UNVERIFIED_SEARCH" }),
    ]);
    const view = buildOverseasReference(s)!;
    expect(view.unverifiedPriceNote).toBe("2곳은 가격을 확인하지 못해 위 금액에 넣지 않았습니다.");
    /** 🔴 §11 ④ — 금액을 그 줄에 합치지 않는다(범위를 만들지 않는다). */
    expect(view.unverifiedPriceNote).not.toMatch(/\d{2,}|21\.2|19,?100/);
    /** 🟢 확인된 금액만 남는다 — CAD 축이 아예 없다. */
    expect(view.lines.map((l) => l.currency)).toEqual(["GBP"]);
    expect(view.lines[0].lowest).toContain("75");
  });

  it("B-2 🟢 미확인이 0 이면 그 줄은 **서지 않는다**(「0곳」을 만들지 않는다)", () => {
    const view = buildOverseasReference(
      summarizeCandidateOverseasPrices([rec({ priceStatus: "VERIFIED_CURRENT" })]),
    )!;
    expect(view.unverifiedPriceNote).toBeNull();
  });

  it("B-3 🟢 `unverifiedCount` 칸이 없는 기존 summary 도 그대로 돈다(하위호환)", () => {
    const view = buildOverseasReference({
      count: 1,
      byCurrency: { EUR: { count: 1, lowestAmount: 40 } },
      byMarket: { OVERSEAS: 1 },
      byPriceTier: { EXACT: 1 },
    })!;
    expect(view.unverifiedPriceNote).toBeNull();
    expect(view.lines[0].currency).toBe("EUR");
  });

  it("B-5 🔴🔴 **확인가가 하나도 없으면 이 블록은 서지 않는다** — 실측 사례를 계약으로 적어 둔다", () => {
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔴🔴 실측 — `B226AC043`(스냅샷 `0ddfc719` · 후보 5건 **전건 UNVERIFIED**)
     * ══════════════════════════════════════════════════════════════════════
     * ```
     * 전: CAD 26,300(1곳) · EUR 39(1곳) · GBP 39.5(1곳) · USD 11,300 ~ 12,700(2곳)
     * 후: **(렌더 안 됨)** · 미확인 5 · 🔴 그래서 「미확인 N곳」 줄도 **같이 사라진다**
     * ```
     * 🟢 **그것이 이 블록의 기존 계약이다** — `lines.length === 0 → null`(제목이
     *    「확인한 가격」이므로 **확인가 0 에 블록을 세우면 빈 주장** 이 된다).
     *    🔴 `MarketPriceComparison:1343·1519` 가 **그 조건을 같이 읽으므로** 여기서
     *       바꾸면 두 곳이 어긋난다 ⟹ 🔴 **이 WU 에서 바꾸지 않았다.**
     * 🟢 후보는 **숨겨지지 않는다** — 개별 후보 줄이 「가격 확인 필요」/「가격 미확인」을
     *    이미 말한다(`CandidateComparison:212` · `ComparisonShopSearch:129` ·
     *    `GeminiTransientCandidates:83`).
     * 🔵 「그 상태에서 집계 블록이 무엇을 말할 것인가」는 **노출 등급 ↔ 가격 자격 분리
     *    (CPO 실행 우선순위 2)** 의 판단 대상이다 — 이 계약이 그 자리를 표시한다.
     */
    const s = summarizeCandidateOverseasPrices([
      rec({ currency: "CAD", amount: 26300, priceStatus: "UNVERIFIED_SEARCH" }),
      rec({ currency: "USD", amount: 12700, priceStatus: "UNVERIFIED_SEARCH" }),
    ]);
    expect(s.unverifiedCount).toBe(2);
    expect(s.byCurrency).toEqual({});
    /** 🔴 이 null 이 **의도된 현재 동작** 이다(바뀌면 이 단언이 FAIL 로 뒤집힌다). */
    expect(buildOverseasReference(s)).toBeNull();
    /** 🟢 그래도 관측은 남는다 — 후보 수와 등급 분포가 그대로다. */
    expect(s.count).toBe(2);
    expect(s.byPriceTier.EXACT).toBe(2);
  });

  it("B-4 🔴 「제외했다」로 적지 않는다 — 후보는 그대로 보인다", () => {
    const view = buildOverseasReference(
      summarizeCandidateOverseasPrices([
        rec({ priceStatus: "VERIFIED_CURRENT" }),
        rec({ amount: 21.2, priceStatus: "UNVERIFIED_SEARCH" }),
      ]),
    )!;
    expect(view.unverifiedPriceNote).not.toMatch(/제외|삭제|버렸|숨겼/);
    expect(view.unverifiedPriceNote).toContain("확인하지 못해");
  });
});

describe("STAGE 7-1 — C. 배선 — 운영이 그 값을 «실제로 넘기는가»", () => {
  /**
   * 🔴🔴 WU-110 교훈 — **판정 함수를 직접 부르는 단언은 배선을 못 본다.**
   *    `priceStatus: e.priceStatus` 를 지워도 위 A/B 는 **전부 통과** 한다.
   *    🟢 그래서 소스 앵커를 **같이** 둔다(두 push 자리 전수).
   */
  const SRC = readFileSync(join(__dirname, "..", "market-intelligence.ts"), "utf8");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const code = strip(SRC);

  it("C-1 🔴 해외 push 와 국내 push **둘 다** `priceStatus` 를 넘긴다", () => {
    const pushes = code.split("priceStatus: e.priceStatus").length - 1;
    expect(pushes).toBe(2);
  });

  it("C-2 🔴 가격 신뢰도를 **지어내지 않는다** — 리터럴 상태 문자열을 넘기지 않는다", () => {
    expect(code).not.toMatch(/priceStatus:\s*["'`]/);
  });

  it("C-3 🔴 집계기가 확인 상태를 **단일 상수** 로 본다(사본 금지)", () => {
    const agg = strip(readFileSync(join(__dirname, "..", "candidate-market.ts"), "utf8"));
    /** 🟢 리터럴은 상수 선언 **한 곳** 에만 있어야 한다. */
    expect(agg.split('"VERIFIED_CURRENT"').length - 1).toBe(1);
    expect(agg).toContain("PRICE_VERIFIED_STATUS");
  });

  it("C-4 🔴🔴 `priceTierFromLink` 를 건드리지 않았다 — tier 는 그대로이고 «금액 자격» 만 좁혔다", () => {
    const tierSrc = strip(
      readFileSync(
        join(__dirname, "..", "..", "..", "domestic-price-sources", "_lib", "domestic-product-link.ts"),
        "utf8",
      ),
    );
    expect(tierSrc).not.toContain("priceStatus");
    expect(tierSrc).not.toContain("VERIFIED_CURRENT");
  });
});
