import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OBSERVED_DIFFERENCE_BLOCKER_LIST } from "@commerce/crawler";
import {
  PRICE_DISQUALIFYING_BLOCKER_LIST,
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../candidate-market";
import { buildOverseasReference } from "../../../../pipeline/commerce/overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 7-2 — **노출 등급 ↔ 가격 «자격» 분리**(CPO 실행 우선순위 2)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 과제: 「`PRESUMED_SAME → TEXT_CONFIRMED → COMPARISON` 경로가 **DIFFERENT
 *    사례를 금액 집계로 유입** 시키는 문제를 해결하라. 🔴 **후보를 숨겨서 해결하지
 *    말고**, 노출은 유지하고 **가격의 의미와 집계 자격을 분리** 하라.」
 *
 * 🔴 CPO 실행 원칙: 「**1번과 2번은 하나의 변경으로 뭉개지 않는다**」 ⟹ 🟢 이 파일은
 *    **「관측된 차이」 축 하나만** 잠근다(가격 신뢰도 축은 STAGE 7-1 파일이 잠근다).
 *
 * 🟢🟢 **새 축을 만들지 않았다** — 쓰는 blocker 는 **이미 계산된 값** 이고 집합은
 *    `PRICE_DISQUALIFYING_BLOCKERS`(가격 정책 · `candidate-market.ts` 머리) 하나다.
 * 🔴 Identity 의 `OBSERVED_DIFFERENCE_BLOCKERS` 는 **한 글자도 고치지 않았다** —
 *    계약이 가격 집합이 그것의 **부분집합** 임을 단언한다.
 * 🔴🔴 **전체를 쓰지 않은 이유는 측정이다**(반사실 `stage7-2-price-eligibility-cf`):
 *    전체(A) 정밀도 11/15 · 재현 **11/18**(손실 1) ↔ 이 집합(B) **12/16 · 12/18**(손실 0).
 */

const rec = (o: Partial<CandidateOverseasPriceRecord>): CandidateOverseasPriceRecord => ({
  market: "OVERSEAS",
  currency: "GBP",
  amount: 37,
  priceTier: "COMPARISON",
  verdict: "PRESUMED_SAME",
  ...o,
});

describe("STAGE 7-2 — A. 「관측된 차이」가 있으면 동일상품 금액으로 쓰지 않는다", () => {
  it("A-1 🔴 `SAME_SELLER_DISTINCT_LISTING` — 판매처가 «스스로» 다른 상품이라 말한다(실측 C19)", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ amount: 75, sellerKey: "a.com" }),
      rec({ amount: 21.2, sellerKey: "b.com", blockers: ["SAME_SELLER_DISTINCT_LISTING"] }),
    ]);
    expect(s.byCurrency.GBP).toEqual({ count: 1, lowestAmount: 75, highestAmount: 75 });
    expect(s.observedDifferenceCount).toBe(1);
  });

  it("A-2 🔴 `COLOR_VARIANT` 단독은 **막지 않는다** — 분류표에 없다(Identity 정책 불변)", () => {
    /**
     * 🔴 **실측을 그대로 적는다** — `COLOR_VARIANT` 는 `OBSERVED_DIFFERENCE_BLOCKERS`
     *    에 **없다**(WU-044 가 「색조 일치 + 색상명 불일치」를 **보류** 로 둔 자리).
     *    ⟹ 그래서 C25(`main-story` · human DIFFERENT)는 **여전히 금액에 들어간다**.
     * 🔴 그 분류표를 **이 WU 에서 고치지 않았다** — Identity 정책이고 CPO 판단 사안이다.
     *    (CPO ⑤ 가 「PATTERN 을 판정/blocker 에 반영하는 것은 **아직 승인하지 않는다**」)
     * 🟢 이 계약은 **그 사실을 숨기지 않기 위해** 있다 — 바꾸면 FAIL 로 뒤집힌다.
     */
    expect(OBSERVED_DIFFERENCE_BLOCKER_LIST).not.toContain("COLOR_VARIANT");
    const s = summarizeCandidateOverseasPrices([rec({ amount: 21.2, blockers: ["COLOR_VARIANT"] })]);
    expect(s.byCurrency.GBP.lowestAmount).toBe(21.2);
    expect(s.observedDifferenceCount).toBe(0);
  });

  it("A-3 🔴🔴 `BRAND_UNCONFIRMED` 는 **막지 않는다** — 「모르는 것」을 반증으로 쓰지 않는다", () => {
    /**
     * 🔴 실측 — 그 사유로 보류된 **4건이 사람 SAME** 이다(C11·C14·C37·C48).
     *    C48 은 `corePoints` 가 **11**(기준 5의 2배)인데 브랜드 칸 하나가 비어 걸렸다.
     * ⟹ 막으면 **recall 을 4건 잃는다**. 🟢 owner 가 그 집합에서 의도적으로 뺐다.
     */
    expect(OBSERVED_DIFFERENCE_BLOCKER_LIST).not.toContain("BRAND_UNCONFIRMED");
    const s = summarizeCandidateOverseasPrices([rec({ blockers: ["BRAND_UNCONFIRMED"] })]);
    expect(s.byCurrency.GBP.lowestAmount).toBe(37);
    expect(s.observedDifferenceCount).toBe(0);
  });

  it("A-3b 🔴🔴 `MATERIAL`·`FIT`·`MODEL_CODE_AGE_LINE` 은 **막지 않는다** — 실측이 그것을 막았다", () => {
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔴🔴 **운영 실측 — 전체 집합을 쓰면 «같은 브랜드·같은 제목» 이 떨어진다**
     * ══════════════════════════════════════════════════════════════════════
     * ```
     * B226AC033 junioredition 「Bobo Choses Pop Sweatshirt by Bobo Choses」
     *           GBP 58 · **VERIFIED_CURRENT** · 보류 **[MATERIAL]** 하나
     * B226AC110 junioredition 「Bobo Choses Embossed T-Shirt by Bobo Choses」
     *           GBP 37 · **VERIFIED_CURRENT** · 보류 **[MODEL_CODE_AGE_LINE]**
     *           🔴 그 축(AC↔AB)은 **CEO 가 SAME 이라 라벨** 했고 **CPO ③ 가 현행 유지** 다
     * 저장 GT  S1-4 kolkid.ca · human **SAME** · 보류 **[FIT]**(relaxed ↔ loose)
     *           🔵 그 어휘는 **CPO ④ 동의어 정규화** 대상이다
     * ```
     * ⟹ 🟢 그래서 **표기·정규화·정책 축은 가격 자격에서 빼 두었다.**
     * 🔴 이 계약을 지우면 그 세 건이 조용히 금액에서 사라진다.
     */
    for (const b of ["MATERIAL", "FIT", "SIZE_SYSTEM", "MODEL_CODE_AGE_LINE", "GARMENT_FORM", "AUDIENCE_LINE"]) {
      const s = summarizeCandidateOverseasPrices([rec({ blockers: [b] })]);
      expect(s.byCurrency.GBP?.lowestAmount, `🔴 ${b} 가 금액에서 빠졌다`).toBe(37);
      expect(s.observedDifferenceCount, `🔴 ${b}`).toBe(0);
    }
  });

  it("A-4 🟢 관측은 지우지 않는다 — count·byMarket·byPriceTier 는 **전건을 센다**", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ amount: 75 }),
      rec({ amount: 21.2, blockers: ["NO_TITLE_OVERLAP"] }),
    ]);
    expect(s.count).toBe(2);
    expect(s.byPriceTier.COMPARISON).toBe(2);
    expect(s.observedDifferenceCount).toBe(1);
  });

  it("A-5 🟢 `blockers` 를 안 넘기면 **동작이 한 글자도 바뀌지 않는다**(하위호환)", () => {
    const s = summarizeCandidateOverseasPrices([rec({ amount: 21.2 }), rec({ amount: 37 })]);
    expect(s.byCurrency.GBP).toEqual({ count: 2, lowestAmount: 21.2, highestAmount: 37 });
    expect(s.observedDifferenceCount).toBe(0);
  });

  it("A-6 🔴 빈 배열은 「차이 없음」이다 — 막지 않는다", () => {
    const s = summarizeCandidateOverseasPrices([rec({ blockers: [] })]);
    expect(s.byCurrency.GBP.lowestAmount).toBe(37);
    expect(s.observedDifferenceCount).toBe(0);
  });

  it("A-7 🔴 분류표 전수가 **금액 자격을 막는다** — 하나라도 빠지면 FAIL", () => {
    /** 🔴 분류표에 blocker 가 추가되면 이 계약이 **자동으로** 그것까지 요구한다. */
    for (const b of PRICE_DISQUALIFYING_BLOCKER_LIST) {
      const s = summarizeCandidateOverseasPrices([rec({ blockers: [b] })]);
      expect(s.byCurrency.GBP, `🔴 ${b} 가 금액에 들어왔다`).toBeUndefined();
      expect(s.observedDifferenceCount, `🔴 ${b}`).toBe(1);
    }
    expect(PRICE_DISQUALIFYING_BLOCKER_LIST.length).toBe(3);
  });

  it("A-8 🔴 두 축을 **갈라 센다** — 가격 미확인과 상품 차이는 다른 사실이다", () => {
    const s = summarizeCandidateOverseasPrices([
      rec({ amount: 75 }),
      rec({ amount: 21.2, priceStatus: "UNVERIFIED_SEARCH" }),
      rec({ amount: 50, blockers: ["NO_TITLE_OVERLAP"] }),
    ]);
    expect(s.unverifiedCount).toBe(1);
    expect(s.observedDifferenceCount).toBe(1);
    expect(s.byCurrency.GBP).toEqual({ count: 1, lowestAmount: 75, highestAmount: 75 });
  });

  it("A-9 🔴 순서 — 「상품 차이」가 **가격 유무보다 앞** 이다(금액 없는 차이도 센다)", () => {
    /**
     * 🔴 금액이 없어도 「상품 차이가 관측됐다」는 **사실이다** ⟹ 그 수에 센다.
     *    (반대로 하면 「차이 N곳」이 금액 유무에 따라 흔들려 화면이 일관되지 않는다)
     */
    const s = summarizeCandidateOverseasPrices([rec({ amount: null, blockers: ["BRAND_MISMATCH"] })]);
    expect(s.observedDifferenceCount).toBe(1);
  });
});

describe("STAGE 7-2 — B. 화면이 두 사실을 «다른 말» 로 한다", () => {
  it("B-1 🔴 「상품 차이가 확인돼」 한 줄이 선다 — 🔴 「다른 상품입니다」로 단정하지 않는다", () => {
    const view = buildOverseasReference(
      summarizeCandidateOverseasPrices([
        rec({ amount: 75 }),
        rec({ amount: 21.2, blockers: ["SAME_SELLER_DISTINCT_LISTING"] }),
      ]),
    )!;
    expect(view.observedDifferenceNote).toBe("1곳은 상품 차이가 확인돼 동일상품 가격에 넣지 않았습니다.");
    /** 🔴 최종 판단은 셀러가 한다 — 단정 어휘를 쓰지 않는다(CPO 표 마지막 줄). */
    expect(view.observedDifferenceNote).not.toMatch(/다른 상품입니다|아닙니다|제외했습니다|삭제/);
    /** 🔴 금액을 그 줄에 합치지 않는다. */
    expect(view.observedDifferenceNote).not.toMatch(/21\.2|75/);
  });

  it("B-2 🔴 두 줄이 **서로 다른 문장** 이다 — 합치지 않는다", () => {
    const view = buildOverseasReference(
      summarizeCandidateOverseasPrices([
        rec({ amount: 75 }),
        rec({ amount: 21.2, priceStatus: "UNVERIFIED_SEARCH" }),
        rec({ amount: 50, blockers: ["NO_TITLE_OVERLAP"] }),
      ]),
    )!;
    expect(view.unverifiedPriceNote).toContain("가격을 확인하지 못해");
    expect(view.observedDifferenceNote).toContain("상품 차이가 확인돼");
    expect(view.unverifiedPriceNote).not.toBe(view.observedDifferenceNote);
  });

  it("B-3 🟢 0 이면 그 줄은 서지 않는다 · 칸이 없는 기존 summary 도 그대로 돈다", () => {
    expect(buildOverseasReference(summarizeCandidateOverseasPrices([rec({})]))!.observedDifferenceNote).toBeNull();
    const legacy = buildOverseasReference({
      count: 1,
      byCurrency: { EUR: { count: 1, lowestAmount: 40 } },
      byMarket: { OVERSEAS: 1 },
      byPriceTier: { EXACT: 1 },
    })!;
    expect(legacy.observedDifferenceNote).toBeNull();
  });
});

describe("STAGE 7-2 — C. 배선과 경계", () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const INTEL = strip(readFileSync(join(__dirname, "..", "market-intelligence.ts"), "utf8"));
  const AGG = strip(readFileSync(join(__dirname, "..", "candidate-market.ts"), "utf8"));

  it("C-1 🔴 해외 push 와 국내 push **둘 다** `blockers` 를 넘긴다", () => {
    expect(INTEL.split("blockers: e.crossSellerBlockers").length - 1).toBe(2);
  });

  it("C-2 🔴🔴 집계가 분류표의 **사본을 만들지 않는다** — owner 함수를 부른다", () => {
    /** 🟢 가격 집합이 Identity 의 「관측된 차이」 집합의 **부분집합** 이다. */
    for (const b of PRICE_DISQUALIFYING_BLOCKER_LIST) {
      expect(OBSERVED_DIFFERENCE_BLOCKER_LIST, `🔴 ${b}`).toContain(b);
    }
    /** 🔴 표기·정규화·정책 축은 가격 집합에 **없다**(CPO ③④⑥). */
    for (const b of ["MATERIAL", "FIT", "SIZE_SYSTEM", "MODEL_CODE_AGE_LINE", "GARMENT_FORM", "AUDIENCE_LINE"]) {
      expect(PRICE_DISQUALIFYING_BLOCKER_LIST, `🔴 ${b}`).not.toContain(b);
    }
    /** 🔴 집합 리터럴은 **한 곳** 에만 있어야 한다. */
    expect(AGG.split('"SAME_SELLER_DISTINCT_LISTING"').length - 1).toBe(1);
  });

  it("C-3 🔴 Identity 정책을 건드리지 않았다 — 분류표·verdict·tier **불변**", () => {
    const CS = strip(
      readFileSync(
        join(
          __dirname,
          "..",
          "..",
          "..",
          "..",
          "..",
          "..",
          "..",
          "..",
          "packages",
          "crawler",
          "src",
          "comparison-search",
          "cross-seller.ts",
        ),
        "utf8",
      ),
    );
    /** 🟢 분류표에 COLOR_VARIANT 가 **들어가지 않았다**(A-2 와 같은 사실을 소스에서도 본다). */
    const set = CS.slice(CS.indexOf("OBSERVED_DIFFERENCE_BLOCKERS"), CS.indexOf("export function hasObservedDifference"));
    expect(set).not.toContain("COLOR_VARIANT");
    expect(set).not.toContain("BRAND_UNCONFIRMED");
    /** 🔴 가격 어휘가 Identity 파일로 새지 않았다. */
    expect(CS).not.toContain("VERIFIED_CURRENT");
    expect(CS).not.toContain("unverifiedCount");
  });

  it("C-4 🔴 `priceTierFromLink` 는 그대로다 — 바뀐 것은 «금액 자격» 하나다", () => {
    const tierSrc = strip(
      readFileSync(
        join(__dirname, "..", "..", "..", "domestic-price-sources", "_lib", "domestic-product-link.ts"),
        "utf8",
      ),
    );
    expect(tierSrc).not.toContain("hasObservedDifference");
    expect(tierSrc).not.toContain("blockers");
  });
});
