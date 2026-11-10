import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "./source-text";
import {
  buildMarketJudgement,
  buildPriceGuide,
  candidatePriceUse,
  CANDIDATE_PRICE_USE_LABEL,
  selectCandidateList,
} from "../mi-same-candidates";
/** 🔴 **타입을 owner 에서 읽는다** — 이 트랙이 열두 번 틀린 그 자리다. */
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import {
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../../../api/price-history/_lib/candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-OVERSEAS-PRICE-CANDIDATE-CONSISTENCY-1 — **카드는 «화면 숫자» 와 맞아야 한다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 직전 WU(`MDPC-1`)는 카드를 **서버 집계** 와 맞췄다. 그것으로 부족했다 —
 *    **화면의 가격 owner 가 분기** 하기 때문이다(`MarketBlock`):
 * ```
 * sameCount === 0 → <OverseasReferencePrice>   서버 집계(SAME **+ 추정**)
 * sameCount  > 0 → price-guide-*               buildPriceGuide(**SAME 전용**)
 * ```
 *    두 분기의 **제목이 같다** ⟹ SAME 이 하나 생기면 추정 후보의 가격이 화면에서
 *    조용히 빠지는데 카드는 「참고가격에 반영」이라 적었다.
 *
 * 🔴 **운영 DB 실측(2026-11-11 · 읽기 전용)** — 스냅샷 `25a3bba7…`
 *    (`bobochoses.com/en-kr/products/b226ac033-bobo-choses-pop-sweatshirt`):
 * ```
 * bonbonverona.it   EUR 62 EXACT      SAME          VERIFIED_CURRENT blockers []
 * junioredition.com GBP 58 COMPARISON PRESUMED_SAME VERIFIED_CURRENT blockers ["MATERIAL"]
 * ⟹ 화면 최저 62 · 집계 최저 58 · 🔴 GBP 축이 화면에서 **사라진다**
 * ```
 * 🔴 아래 행은 **그 실측값 그대로** 다(지어내지 않았다).
 *
 * 🔴 **고치지 않은 것** — 집계기 · `buildPriceGuide` · `buildMarketJudgement` ·
 *    분모 · 자격 조건 · tier · verdict · 판정 · CASE · 추천가격 · 환산 · 차액 **0.**
 */

const DIR = join(__dirname, "..");
const SEL_SRC = stripComments(readFileSync(join(DIR, "mi-same-candidates.ts"), "utf8").replace(/\r\n/g, "\n"));
const MPC_SRC = stripComments(
  readFileSync(join(DIR, "MarketPriceComparison.tsx"), "utf8").replace(/\r\n/g, "\n"),
);

/* ══════════════════════ 운영 DB 실측 두 행(시장만 인자로) ══════════════════════ */

const sameRow = (market: "KR" | "OVERSEAS"): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "bonbonverona.it",
    title: "Bobo Choses Pop Sweatshirt",
    imageUrl: null,
    soldOut: null,
    discoveredUrl: "https://bonbonverona.it/products/bobo-choses-pop-sweatshirt-b226ac033-401-bobo-choses",
    matchTruth: "STRONG_IDENTIFIER",
    priceTier: "EXACT",
    crossSellerVerdict: "SAME",
    confidence: 0.9,
    matchReasons: ["품번 일치"],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: 62,
    priceCurrency: "EUR",
    priceStatus: "VERIFIED_CURRENT",
    market,
    basis: "DOMAIN",
  }) as unknown as GeminiTransientRow;

const presumedRow = (market: "KR" | "OVERSEAS"): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "junioredition.com",
    title: "Bobo Choses Pop Sweatshirt by Bobo Choses",
    imageUrl: null,
    soldOut: null,
    discoveredUrl: "https://junioredition.com/products/bobo-choses-pop-sweatshirt-by-bobo-choses",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    confidence: 0.7,
    matchReasons: ["핵심 상품명 일치"],
    /** 🔴 `MATERIAL` 은 금액 자격을 뺏지 않는다 — 그래서 집계에는 **들어간다**. */
    crossSellerBlockers: ["MATERIAL"],
    crossSellerConflicts: [],
    priceAmount: 58,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    market,
    basis: "DOMAIN",
  }) as unknown as GeminiTransientRow;

/** 🔴 `overseasEvidence.push` 모양 그대로(market-intelligence.ts) — verdict 를 싣는다. */
const toRecord = (r: GeminiTransientRow): CandidateOverseasPriceRecord =>
  ({
    domain: r.domain,
    url: r.discoveredUrl,
    market: r.market,
    basis: "DOMAIN",
    currency: r.priceCurrency,
    amount: r.priceAmount,
    priceKrwDerived: null,
    priceTier: r.priceTier,
    matchTruth: r.matchTruth,
    verdict: r.crossSellerVerdict,
    priceStatus: r.priceStatus,
    blockers: r.crossSellerBlockers,
  }) as unknown as CandidateOverseasPriceRecord;

/** 🟢 **화면 숫자** — `MarketBlock` 이 `sameCount > 0` 일 때 그리는 그 집계. */
const screenCurrencies = (rows: GeminiTransientRow[], market: "KR" | "OVERSEAS"): string[] =>
  buildPriceGuide(buildMarketJudgement(rows), market).byCurrency.map((c) => c.currency);

/* ════════════════════════════════ A. 평형 ════════════════════════════════ */

describe("MOPC-1 A — 🔴 카드는 **화면에 실제로 선 숫자** 와 맞아야 한다", () => {
  it("A-1 🔴🔴 실측 두 행 — 추정 후보가 「반영」이라 적던 자리(이 WU 가 고친 것)", () => {
    const rows = [sameRow("OVERSEAS"), presumedRow("OVERSEAS")];
    const g = buildPriceGuide(buildMarketJudgement(rows), "OVERSEAS");

    /** ① 전제 — 둘 다 **카드로 선다**(숨기지 않는다). */
    expect(selectCandidateList(rows, "OVERSEAS")).toHaveLength(2);
    /** ② 전제 — SAME 이 있으니 화면은 **SAME 전용 가이드** 로 분기한다. */
    expect(g.sameCount, "🔴 분기 전제가 바뀌었다").toBe(1);
    /** ③ 🔴 그 화면 숫자에는 **GBP 축이 없다** — 추정 후보의 통화가 사라진다. */
    expect(screenCurrencies(rows, "OVERSEAS")).toEqual(["EUR"]);
    /** ④ 🟢 그런데 **서버 집계는 그 금액을 담는다** — 그래서 카드가 「반영」이라 적었다. */
    const agg = summarizeCandidateOverseasPrices(rows.map(toRecord));
    expect(agg.byCurrency.GBP?.lowestAmount, "🔴 집계 전제가 바뀌었다").toBe(58);

    /** ⑤ 🔴🔴 그러므로 카드는 「반영」이라 적을 수 없다. */
    expect(
      candidatePriceUse(presumedRow("OVERSEAS"), { sameOnlyPriceAxis: g.sameCount > 0 }),
      "🔴🔴 화면에 없는 금액을 카드가 「참고가격에 반영」이라 적는다",
    ).toBe("SAME_AXIS_ONLY");
    /** 🟢 SAME 행은 그대로 「반영」이다 — 기능을 죽이지 않았다. */
    expect(candidatePriceUse(sameRow("OVERSEAS"), { sameOnlyPriceAxis: true })).toBe("USED");
  });

  it("A-2 🔴🔴 **전수 평형** — 「반영」이라 적힌 후보의 통화는 화면 숫자에 **있다**", () => {
    /**
     * 🔴 분모를 숨기지 않는다 — 조합마다 「카드가 섰는가」와 「반영이라 적었는가」를
     *    세고, **반영인데 화면에 통화가 없는** 행을 모은다(그것이 거짓이다).
     */
    const TIERS = ["EXACT", "COMPARISON", "REFERENCE", "EXCLUDED"] as const;
    const TRUTHS = ["STRONG_IDENTIFIER", "TEXT_CONFIRMED", "SIMILAR", "CONFLICT"] as const;
    const VERDICTS = ["SAME", "PRESUMED_SAME", "CONFLICT"] as const;
    const lies: string[] = [];
    let carded = 0;
    let usedCount = 0;
    for (const market of ["KR", "OVERSEAS"] as const) {
      for (const tier of TIERS)
        for (const matchTruth of TRUTHS)
          for (const verdict of VERDICTS) {
            const probe = {
              ...presumedRow(market),
              priceTier: tier,
              matchTruth,
              crossSellerVerdict: verdict,
              crossSellerBlockers: [],
            } as unknown as GeminiTransientRow;
            /** 🟢 화면에는 **SAME 행이 하나 있는 상태** 를 만든다(분기가 SAME 전용이 되도록). */
            const rows = [sameRow(market), probe];
            const g = buildPriceGuide(buildMarketJudgement(rows), market);
            if (selectCandidateList(rows, market).length < 2) continue;
            carded += 1;
            const use = candidatePriceUse(probe, { sameOnlyPriceAxis: g.sameCount > 0 });
            if (use !== "USED") continue;
            usedCount += 1;
            if (!screenCurrencies(rows, market).includes(probe.priceCurrency as string)) {
              lies.push(`${market}/${tier}/${matchTruth}/${verdict}`);
            }
          }
    }
    expect(carded, "🔴 카드가 서는 조합이 없다 — 하니스가 측정을 못 하고 있다").toBeGreaterThan(5);
    expect(usedCount, "🔴 「반영」이 하나도 안 난다 — 이 전수는 거짓을 못 잡는다").toBeGreaterThan(0);
    expect(lies, `🔴🔴 화면에 없는 금액을 「반영」이라 적는다:\n${lies.join("\n")}`).toEqual([]);
  });

  it("A-3 🟢 **SAME 이 없으면** 추정 후보는 여전히 「반영」이다(서버 집계가 그리는 분기)", () => {
    const rows = [presumedRow("OVERSEAS")];
    const g = buildPriceGuide(buildMarketJudgement(rows), "OVERSEAS");
    expect(g.sameCount, "전제 — SAME 이 없다").toBe(0);
    /** 🔴 그 분기의 화면 숫자는 **서버 집계** 다 ⟹ GBP 58 이 실제로 선다. */
    expect(summarizeCandidateOverseasPrices(rows.map(toRecord)).byCurrency.GBP?.lowestAmount).toBe(58);
    expect(
      candidatePriceUse(rows[0], { sameOnlyPriceAxis: g.sameCount > 0 }),
      "🔴 화면에 서는 금액을 「미반영」이라 적었다 — 반대 방향 거짓이다",
    ).toBe("USED");
  });

  it("A-4 🔴 **국내도 같은 분기** 다 — 한쪽만 고치지 않았다", () => {
    const rows = [sameRow("KR"), presumedRow("KR")];
    const g = buildPriceGuide(buildMarketJudgement(rows), "KR");
    expect(g.sameCount).toBe(1);
    expect(candidatePriceUse(presumedRow("KR"), { sameOnlyPriceAxis: g.sameCount > 0 })).toBe(
      "SAME_AXIS_ONLY",
    );
  });

  it("A-5 🟢 **opts 를 넘기지 않으면 동작이 불변** 이다(기존 호출부 보호)", () => {
    expect(candidatePriceUse(presumedRow("OVERSEAS"))).toBe("USED");
    expect(candidatePriceUse(presumedRow("OVERSEAS"), {})).toBe("USED");
    expect(candidatePriceUse(presumedRow("OVERSEAS"), { sameOnlyPriceAxis: false })).toBe("USED");
  });

  it("A-6 🔴 **순서** — 가격이 없거나 상품 차이가 관측되면 그 사유가 **이긴다**", () => {
    const noPrice = { ...presumedRow("OVERSEAS"), priceAmount: null } as unknown as GeminiTransientRow;
    expect(candidatePriceUse(noPrice, { sameOnlyPriceAxis: true })).toBe("NOT_PRICED");
    const diff = {
      ...presumedRow("OVERSEAS"),
      crossSellerBlockers: ["BRAND_MISMATCH"],
    } as unknown as GeminiTransientRow;
    expect(
      candidatePriceUse(diff, { sameOnlyPriceAxis: true }),
      "🔴 제외 사유가 「미반영」으로 덮였다 — 셀러가 이유를 잃는다",
    ).toBe("EXCLUDED_OBSERVED_DIFFERENCE");
  });
});

/* ════════════════════════════════ B. 보존 ════════════════════════════════ */

describe("MOPC-1 B — 🟢 **집계·분기·어휘를 바꾸지 않았다**", () => {
  it("B-1 🟢 화면 분기 조건과 두 선별기가 그대로다", () => {
    /** 🔴 `MarketBlock` 의 분기 — 이 식이 바뀌면 `sameOnlyPriceAxis` 의 뜻이 틀어진다. */
    expect(MPC_SRC, "🔴 화면 분기 조건이 바뀌었다").toContain("g.sameCount === 0 ? hasReferencePrice(reference) : true");
    /** 🔴 `buildMarketJudgement` 는 **SAME 만** 담는다(가격 축 선별기 불변). */
    expect(SEL_SRC).toContain('if (transientDisplayTier(row) !== "SAME") continue;');
  });

  it("B-2 🔴 **배선** — 두 칸 모두 같은 함수의 산출을 넘긴다(마운트 DOM 이 못 보는 축)", () => {
    for (const mk of ["KR", "OVERSEAS"]) {
      expect(
        MPC_SRC,
        `🔴 ${mk} 칸의 배선이 끊겼다 — 카드가 분기를 모른 채 「반영」이라 적는다`,
      ).toContain(`sameOnlyPriceAxis={buildPriceGuide(judgement, "${mk}").sameCount > 0}`);
    }
    /**
     * 🔴🔴 **1차 앵커가 변이 N5 에 뚫렸고 그래서 강화했다.** 그 줄은 이 파일에 **네 번**
     *    등장한다(라벨 유무 · `data-use` · className · 본문) ⟹ `toContain` 하나로는
     *    **한 곳을 끊어도 통과** 했다. 🟢 그래서 **「옵션 없이 부르는 호출이 0」** 을 센다.
     */
    expect(
      MPC_SRC.match(/candidatePriceUse\(row\)/g) ?? [],
      "🔴 분기 값을 안 넘기는 호출이 남아 있다 — 그 줄의 카드가 「반영」이라 적는다",
    ).toEqual([]);
    const wired = MPC_SRC.match(/candidatePriceUse\(row, \{ sameOnlyPriceAxis \}\)/g) ?? [];
    expect(wired.length, "🔴 배선된 호출이 없다").toBeGreaterThan(0);
    /** 🔴 호출부가 **자기 식** 을 만들면 분기와 갈라진다. */
    expect(MPC_SRC, "🔴 화면이 sameCount 를 손으로 다시 셌다").not.toMatch(
      /sameOnlyPriceAxis=\{(?!buildPriceGuide)/,
    );
  });

  it("B-3 🟢 상태는 **넷** 이고 기존 셋의 글자는 불변이다", () => {
    expect(Object.keys(CANDIDATE_PRICE_USE_LABEL).sort()).toEqual(
      ["EXCLUDED_OBSERVED_DIFFERENCE", "NOT_PRICED", "SAME_AXIS_ONLY", "USED"].sort(),
    );
    expect(CANDIDATE_PRICE_USE_LABEL.USED).toBe("참고가격에 반영");
    expect(CANDIDATE_PRICE_USE_LABEL.EXCLUDED_OBSERVED_DIFFERENCE).toBe("참고가격 제외 — 상품 차이가 확인됨");
    expect(CANDIDATE_PRICE_USE_LABEL.NOT_PRICED).toBeNull();
    const added = CANDIDATE_PRICE_USE_LABEL.SAME_AXIS_ONLY ?? "";
    expect(added).toBe("위 가격에는 미반영 — 동일상품 확정 후보만 집계");
    /**
     * 🔴 새 라벨에 **판정 어휘·내부 토큰** 을 쓰지 않는다 — 등급은 그룹 배지가 말한다.
     * 🔴 「제외」도 쓰지 않는다 — 상품 차이가 관측된 상태와 **다른 사실** 이다.
     */
    for (const banned of ["제외", "추정", "보류", "유사", "SAME", "PRESUMED", "COMPARISON", "tier"]) {
      expect(added, `🔴 '${banned}' 가 새 라벨에 들어갔다`).not.toContain(banned);
    }
  });

  it("B-4 🔴 집계기는 **이 WU 에서 한 글자도** 바뀌지 않았다", () => {
    const AGG = stripComments(
      readFileSync(
        join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "candidate-market.ts"),
        "utf8",
      ).replace(/\r\n/g, "\n"),
    );
    /** 🔴 네 게이트가 그 순서로 살아 있다(직전 WU 의 계약과 같은 축). */
    for (const needle of [
      'r.priceTier === "EXCLUDED"',
      "r.verdict != null && !PRICE_ELIGIBLE_VERDICTS.has(r.verdict)",
      "PRICE_DISQUALIFYING_BLOCKERS.has(b)",
      "r.priceStatus !== PRICE_VERIFIED_STATUS",
    ]) {
      expect(AGG, `🔴 집계 게이트가 사라졌다: ${needle}`).toContain(needle);
    }
    /** 🔴 집계기는 화면 분기를 **모른다** — 알면 서버가 표시 정책을 들고 있는 것이 된다. */
    expect(AGG, "🔴 집계기가 화면 분기를 읽는다").not.toContain("sameOnlyPriceAxis");
  });
});
