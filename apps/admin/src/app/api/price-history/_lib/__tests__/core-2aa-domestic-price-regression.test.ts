import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** 🔴 칸/타입 위치를 추측하지 않는다 — owner 파일에서 읽어 import 한다. */
import type { MatchTruth } from "@commerce/crawler/src/comparison-search/match-truth-rank";

import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { reviewKey } from "../candidate-review";
import { summarizeCandidateOverseasPrices } from "../candidate-market";
import { priceTierWithVerifiedSame } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CORE-2AA STEP 1 — **배선 «전» 에 기존 국내 가격 수집 결과를 잠근다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO 가 순서를 지정했다**(2026-10-25):
 * ```
 * 「특히 donokids / m.luxboy → KRW 59,000~88,000 이 유지되는지 **먼저 자동 회귀로
 *   잠그고**, 그 이후 배선합니다.」
 * ```
 * 🟢 그래서 이 파일은 **CORE-2Z 배선 전에** 통과해야 하고, 배선 «후» 에도 **한 글자도
 *    바뀌지 않고** 통과해야 한다. 바뀌면 그것이 회귀의 증거다.
 *
 * 🔴 **네트워크 0 · DB 0** — 운영 순수 함수(`priceTierFromLink` ·
 *    `summarizeCandidateOverseasPrices`)만 부른다. 그래서 CI 에서 매번 돈다.
 *    (CORE-2Z 는 라이브 하니스라 `CORE2Z_LIVE=1` 없이는 SKIP 이다 ⟹ 회귀를
 *     거기에 맡기면 **아무도 지켜 주지 않는다** — 이 파일이 그 자리를 맡는다.)
 *
 * 🔴🔴 **숫자의 출처를 정직하게 적는다.** `{3곳 · 59,000~88,000}` 은
 *    **CORE-2Z 라이브 측정값**(GT 10건 · 등록부 보정 포함)이고 **현재 운영
 *    화면의 🇰🇷 값이 아니다**(운영은 전수 탐색 결과에 따라 달라진다).
 *    ⟹ 이 파일이 잠그는 것은 **「그 입력을 넣으면 집계기가 그 숫자를 낸다」** 다.
 *    🔴 「운영 화면이 3곳을 보여준다」로 읽지 않는다.
 */

const LINK_SRC = readFileSync(
  resolve(__dirname, "../../../domestic-price-sources/_lib/domestic-product-link.ts"),
  "utf8",
);
const RUNNER_SRC = readFileSync(resolve(__dirname, "../run-domestic-price-check.ts"), "utf8");
const INTEL_SRC = readFileSync(resolve(__dirname, "../market-intelligence.ts"), "utf8");

/** 🔴 소스 문자열 검사는 **주석을 벗기고** 한다(이 트랙에서 아홉 번 걸린 함정). */
function strip(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

/**
 * CORE-2Z 가 라이브로 확정한 **국내 KRW 세 판매처**.
 * 🔴 손으로 고른 집합이 아니다 — GT 10건 중 `market === "KR"`(등록부 보정 포함)으로
 *    **운영 `classifyCandidateMarket` 이 가른** 그 셋이다.
 */
const KR_PRICED = [
  { sellerKey: "biskuit.kr", amount: 88_000, autoTruth: "TEXT_CONFIRMED" as MatchTruth },
  { sellerKey: "m.luxboy.com", amount: 59_000, autoTruth: "TEXT_CONFIRMED" as MatchTruth },
  { sellerKey: "donokids.com", amount: 88_000, autoTruth: "TEXT_CONFIRMED" as MatchTruth },
] as const;

function krRecords(tiers: readonly string[]) {
  return KR_PRICED.map((r, i) => ({
    market: "KR",
    currency: "KRW",
    amount: r.amount,
    priceTier: tiers[i] as never,
    sellerKey: r.sellerKey,
  }));
}

describe("CORE-2AA STEP 1 — 국내 가격 수집 회귀 잠금(배선 전/후 불변)", () => {
  /* ─────────────────────── A. tier 표를 «바이트» 로 잠근다 ─────────────────────── */

  it("AA-1 🔴🔴 `priceTierFromLink` 의 matchTruth → tier 표가 **전수 고정** 이다", () => {
    /**
     * 🔴 CPO 가 ⒜(「`verified` 가 `matchTruth` 를 이기게 순서를 바꾼다」)를 **거부** 했다.
     *    그 거부를 **표 전수** 로 잠근다 — 한 칸이라도 움직이면 FAIL 한다.
     */
    const table: Array<[MatchTruth, string]> = [
      ["EXACT_IDENTIFIER", "EXACT"],
      ["STRONG_IDENTIFIER", "EXACT"],
      ["TEXT_CONFIRMED", "COMPARISON"],
      ["SIMILAR", "REFERENCE"],
      ["CONFLICT", "EXCLUDED"],
      ["INSUFFICIENT_EVIDENCE", "EXCLUDED"],
    ];
    for (const [truth, tier] of table) {
      /** 🔴 **`verified` 양쪽 다** 넣는다 — `matchTruth` 가 있으면 결과가 같아야 한다. */
      expect(priceTierFromLink({ matchTruth: truth, verified: false }), `${truth}/verified=false`).toBe(tier);
      expect(
        priceTierFromLink({ matchTruth: truth, verified: true }),
        `🔴 ${truth} 에서 verified 가 matchTruth 를 이겼다 — CPO 가 거부한 ⒜ 다`,
      ).toBe(tier);
    }
  });

  it("AA-2 🔴 `matchTruth` 가 **없을 때만** `verified` 가 쓰인다(기존 폴백 유지)", () => {
    expect(priceTierFromLink({ matchTruth: null, verified: true })).toBe("EXACT");
    expect(priceTierFromLink({ matchTruth: null, verified: false })).toBe("COMPARISON");
  });

  /* ─────────────────────── B. 국내 집계 숫자를 잠근다 ─────────────────────── */

  it("AA-3 🔴🔴 **배선 전 기준선** — 세 판매처가 자동 tier 그대로면 🇰🇷 {3곳 · 59,000~88,000}", () => {
    /**
     * 🟢 자동 MI 는 셋 다 `TEXT_CONFIRMED` → `COMPARISON` 이다(CORE-2Z 실측).
     * 🟢 그리고 `COMPARISON` 은 **금액 집계에 들어간다**(WU-062 는 `EXCLUDED` 만 뺐다).
     * ⟹ 🔴 **배선 전에도 이 숫자가 나온다.** 배선이 이 값을 «만드는» 것이 아니다 —
     *    그래서 배선 후에도 **같아야** 하고, 달라지면 회귀다.
     */
    const autoTiers = KR_PRICED.map((r) => priceTierFromLink({ matchTruth: r.autoTruth, verified: false }));
    expect(autoTiers, "🔴 자동 tier 가 바뀌면 아래 숫자의 전제가 깨진다").toEqual([
      "COMPARISON",
      "COMPARISON",
      "COMPARISON",
    ]);

    const kr = summarizeCandidateOverseasPrices(krRecords(autoTiers));
    expect(kr.byCurrency.KRW).toEqual({ count: 3, lowestAmount: 59_000, highestAmount: 88_000 });
  });

  it("AA-4 🟢 `VERIFIED_SAME` 이 `EXACT` 를 줘도 **같은 숫자** 다(자격은 금액을 바꾸지 않는다)", () => {
    /**
     * 🔴🔴 이것이 이 파일의 **핵심 단언** 이다. 배선의 목적은 **금액을 바꾸는 것이 아니고**
     *    「그 금액을 쓸 자격을 준다」는 것뿐이다. 그래서 세 판매처가 전부 자격을 얻어
     *    `EXACT` 가 되어도 **금액·판매처 수가 한 칸도 움직이지 않아야** 한다.
     * 🟢 움직이면 배선이 집계를 오염시킨 것이다.
     */
    const kr = summarizeCandidateOverseasPrices(krRecords(["EXACT", "EXACT", "EXACT"]));
    expect(kr.byCurrency.KRW).toEqual({ count: 3, lowestAmount: 59_000, highestAmount: 88_000 });
  });

  it("AA-5 🔴 `EXCLUDED` 는 금액에서 빠지고 `REFERENCE` 는 **남는다**(WU-062 유지)", () => {
    /** 🔴 donokids 를 EXCLUDED 로 떨구면 최저가가 아니라 **count** 가 줄어야 한다. */
    const dropped = summarizeCandidateOverseasPrices(krRecords(["COMPARISON", "COMPARISON", "EXCLUDED"]));
    expect(dropped.byCurrency.KRW).toEqual({ count: 2, lowestAmount: 59_000, highestAmount: 88_000 });

    /** 🔴 m.luxboy(최저가)를 EXCLUDED 로 떨구면 **최저가가 올라간다** — 금액 축이 살아 있다는 증거. */
    const low = summarizeCandidateOverseasPrices(krRecords(["COMPARISON", "EXCLUDED", "COMPARISON"]));
    expect(low.byCurrency.KRW).toEqual({ count: 2, lowestAmount: 88_000, highestAmount: 88_000 });

    /** 🟢 `REFERENCE` 는 빼지 않는다. */
    const ref = summarizeCandidateOverseasPrices(krRecords(["REFERENCE", "COMPARISON", "COMPARISON"]));
    expect(ref.byCurrency.KRW).toEqual({ count: 3, lowestAmount: 59_000, highestAmount: 88_000 });
  });

  it("AA-6 🟢 `sellerKey` 중복 제거가 유지된다(같은 판매처를 두 번 넣어도 불변)", () => {
    const base = krRecords(["COMPARISON", "COMPARISON", "COMPARISON"]);
    const doubled = summarizeCandidateOverseasPrices([...base, ...base]);
    expect(doubled.byCurrency.KRW).toEqual({ count: 3, lowestAmount: 59_000, highestAmount: 88_000 });
  });

  /* ─────────────────────── C. 운영 배선 앵커 ─────────────────────── */

  it("AA-7 🔴 transient push 의 tier owner 는 **`priceTierFromLink` 하나** 다(복제 계산 0)", () => {
    const src = strip(RUNNER_SRC);
    /** 🔴 push 자리에서 tier 를 **직접 문자열로** 쓰지 않는다. */
    expect(src).toContain("priceTierFromLink(");
    expect(src, '🔴 tier 를 리터럴로 박으면 owner 가 둘이 된다').not.toMatch(
      /priceTier:\s*"(EXACT|COMPARISON|REFERENCE|EXCLUDED)"/,
    );
  });

  it("AA-8 🔴🔴 WU-131 격리 유지 — 집계기·tier owner 는 사람 판단을 **읽지 않는다**", () => {
    /**
     * 🔴 이 두 줄이 CPO 가 유지하라고 한 경계다. 배선은 **runner 에서만** 일어나고
     *    `market-intelligence.ts` / `domestic-product-link.ts` 는 끝까지 모른다.
     */
    for (const needle of ["humanVerdict", "human_verdict"]) {
      expect(strip(INTEL_SRC), `🔴 MI 가 ${needle} 를 읽는다 — WU-131 격리가 깨졌다`).not.toContain(needle);
      expect(strip(LINK_SRC), `🔴 tier owner 가 ${needle} 를 읽는다 — CPO 가 거부한 ⒜ 다`).not.toContain(needle);
    }
  });
});

const REVIEW_SRC = readFileSync(resolve(__dirname, "../candidate-review.ts"), "utf8");
const ROUTE_SRC = readFileSync(resolve(__dirname, "../../check/route.ts"), "utf8");

const URL_BISKUIT = "https://biskuit.kr/product/detail.html?product_no=1234";
const URL_LUXBOY = "https://m.luxboy.com/product/view?goodsNo=9876";

describe("CORE-2AA STEP 2 — VERIFIED_SAME 가격 자격 배선", () => {
  /* ─────────────────────── D. 자격 함수 (순수) ─────────────────────── */

  it("AA-9 🔴🔴 자격 집합이 **비면** 자동 tier 가 **전수 그대로** 다(기존 동작 불변)", () => {
    /** 🔴 이것이 CPO 회귀 기준의 핵심이다 — 검토하지 않은 상품은 **한 칸도** 안 바뀐다. */
    for (const autoTier of ["EXACT", "COMPARISON", "REFERENCE", "EXCLUDED"] as const) {
      expect(priceTierWithVerifiedSame({ url: URL_BISKUIT, autoTier })).toBe(autoTier);
      expect(priceTierWithVerifiedSame({ url: URL_BISKUIT, autoTier, verifiedSameUrlKeys: [] })).toBe(autoTier);
      /** 🔴 **다른** URL 이 자격을 가져도 이 후보는 안 바뀐다. */
      expect(
        priceTierWithVerifiedSame({ url: URL_BISKUIT, autoTier, verifiedSameUrlKeys: [reviewKey(URL_LUXBOY)] }),
      ).toBe(autoTier);
    }
  });

  it("AA-10 🟢 자격이 있으면 **`EXACT`** — 자동이 `EXCLUDED` 여도 올라간다", () => {
    const keys = [reviewKey(URL_BISKUIT)];
    for (const autoTier of ["EXACT", "COMPARISON", "REFERENCE", "EXCLUDED"] as const) {
      expect(priceTierWithVerifiedSame({ url: URL_BISKUIT, autoTier, verifiedSameUrlKeys: keys })).toBe("EXACT");
    }
  });

  it("AA-11 🔴🔴 **단조(monotonic)** — 자격이 없다고 자동값을 «내리지» 않는다", () => {
    /**
     * 🔴 이 축이 깨지면 「검토 안 한 상품의 가격이 사라진다」 — CPO 회귀 기준 위반이다.
     *    자격 집합에 **다른 URL 만** 있는 상태에서 자동 `EXACT` 가 보존되는지 본다.
     */
    expect(
      priceTierWithVerifiedSame({
        url: URL_BISKUIT,
        autoTier: "EXACT",
        verifiedSameUrlKeys: [reviewKey(URL_LUXBOY)],
      }),
      "🔴 자격 없음을 «감점» 으로 쓰면 안 된다",
    ).toBe("EXACT");
  });

  it("AA-12 🟢 키는 **정규화** 된다 — 추적 파라미터가 붙어도 같은 후보다", () => {
    const keys = [reviewKey(URL_BISKUIT)];
    const noisy = `${URL_BISKUIT}&utm_source=chatgpt.com&_pos=3`;
    expect(
      priceTierWithVerifiedSame({ url: noisy, autoTier: "EXCLUDED", verifiedSameUrlKeys: keys }),
      "🔴 정규화가 빠지면 같은 후보가 자격을 잃는다",
    ).toBe("EXACT");
  });

  /* ─────────────────────── E. 범위 — CPO 가 고정한 「스냅샷 한정」 ─────────────────────── */

  it("AA-13 🔴🔴 가격 자격 리더는 **`snapshot_id` 만** 본다(`origin_code` 축 금지)", () => {
    const src = strip(REVIEW_SRC);
    const start = src.indexOf("export async function listSnapshotVerifiedSameKeys");
    expect(start, "🔴 가격 자격 리더가 없다").toBeGreaterThan(-1);
    const seg = src.slice(start, src.indexOf("export async function listReviewedSameUrls"));
    expect(seg).toContain('.eq("snapshot_id"');
    /** 🔴🔴 CPO: 「URL 전역 SAME 으로 만들지 않습니다」 — 이 줄이 그 금지다. */
    expect(seg, "🔴 origin_code 를 쓰면 판정이 스냅샷을 넘어 번진다").not.toContain("origin_code");
    /** 🔴 발견 리더를 재사용하면 범위가 넓은 쪽으로 끌려간다. */
    expect(seg, "🔴 listCandidateReviews 를 쓰면 origin_code 축이 같이 들어온다").not.toContain(
      "listCandidateReviews(",
    );
  });

  it("AA-14 🔴 자격은 **`SAME` 만** 이다(`SIMILAR`/`UNDECIDED`/`DIFFERENT` 0)", () => {
    const src = strip(REVIEW_SRC);
    const start = src.indexOf("export async function listSnapshotVerifiedSameKeys");
    const seg = src.slice(start, src.indexOf("export async function listReviewedSameUrls"));
    expect(seg).toContain('.eq("human_verdict", "SAME")');
    for (const no of ["SIMILAR", "UNDECIDED", "DIFFERENT"]) {
      expect(seg, `🔴 ${no} 가 가격 자격에 들어왔다`).not.toContain(`"${no}"`);
    }
  });

  it("AA-15 🔴 라우트가 **두 칸을 가른 채** 넘긴다(발견 ↔ 가격 자격)", () => {
    const src = strip(ROUTE_SRC);
    expect(src).toContain("listSnapshotVerifiedSameKeys({");
    expect(src).toContain("verifiedSameUrlKeys:");
    /** 🔴 가격 자격 질의에 `originCode` 를 넘기면 범위가 번진다. */
    const start = src.indexOf("listSnapshotVerifiedSameKeys({");
    const seg = src.slice(start, start + 220);
    expect(seg, "🔴 가격 자격 질의에 originCode 가 들어갔다").not.toContain("originCode");
    /** 🔴🔴 발견 입력과 **같은 칸** 으로 합치지 않는다. */
    expect(src, "🔴 재투입 배열을 가격 자격으로 그대로 넘기면 범위가 넓어진다").not.toContain(
      "verifiedSameUrlKeys: reviewedSameUrls",
    );
  });

  /* ─────────────────────── F. 자동 MI 불변 ─────────────────────── */

  it("AA-16 🔴🔴 자격은 **`priceTier` 만** 바꾼다 — `matchTruth`/`verified` 는 자동값 그대로", () => {
    const src = strip(RUNNER_SRC);
    const start = src.indexOf("transientEvidenceSink.push({");
    expect(start).toBeGreaterThan(-1);
    const seg = src.slice(start, start + 2600);
    /** 🟢 자동 산출이 그대로 실린다. */
    expect(seg).toContain("matchTruth: finalMatchTruth");
    expect(seg).toContain("verified: finalVerified");
    /** 🟢 자격은 tier 자리에서만 끼어든다. */
    expect(seg).toContain("priceTierWithVerifiedSame({");
    expect(seg).toContain("autoTier: priceTierFromLink({ matchTruth: finalMatchTruth, verified: finalVerified })");
    /** 🔴🔴 CPO 가 거부한 ⒜ — 자격이 `matchTruth` 를 덮어쓰면 FAIL. */
    expect(seg, "🔴 matchTruth 를 자격으로 덮었다 — CPO 거부 항목이다").not.toMatch(
      /matchTruth:\s*(verified|"SAME"|verifiedSame)/,
    );
  });

  it("AA-17 🔴 자격 함수는 **순수** 다 — DB·HTTP·supabase 를 쓰지 않는다", () => {
    const src = strip(RUNNER_SRC);
    const start = src.indexOf("export function priceTierWithVerifiedSame");
    expect(start).toBeGreaterThan(-1);
    /**
     * 🔴🔴 **함수의 끝까지만** 자른다. 1차에 「다음 `export` 까지」로 썼더니
     *    사이에 있던 `judgeDomesticCandidate` 가 통째로 들려와 FAIL 했다 —
     *    이 트랙에서 **네 번째** 같은 실수다(단언 좌표 확인).
     */
    const end = src.indexOf("\n}", start);
    expect(end, "🔴 함수 끝을 못 찾았다").toBeGreaterThan(start);
    const seg = src.slice(start, end);
    for (const no of ["supabase", "fetch(", "await ", "human_verdict", "humanVerdict"]) {
      expect(seg, `🔴 자격 함수가 ${no} 를 쓴다`).not.toContain(no);
    }
  });
});
