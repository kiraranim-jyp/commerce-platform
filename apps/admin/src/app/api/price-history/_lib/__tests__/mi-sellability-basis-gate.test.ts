import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeSellability, deriveRepresentativeSellerVerdict } from "@commerce/pricing";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SELLABILITY-BASIS-GATE — **추정 근거로 「판매 가능」을 올리지 않는다**(CPO ⒜)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **고친 결함** — `resolved` 는 EXACT 가 없으면 **COMPARISON 버킷** 이고
 *    (`price-history.ts:644-646`) 거기에 `PRESUMED_SAME` 이 들어온다(`market-intelligence:675`).
 *    `computeSellability` 는 basis 를 받지 않아 추정/확정을 **구별하지 못했다**:
 * ```
 * 조사 실측(순수 함수)   COMPARISON → **GREEN**   ↔   NONE → YELLOW
 * ⟹ PRESUMED 후보 «한 건» 이 「판매 가능성」을 올렸다
 *    그 후보는 사람 기준 19건 중 **13건(68%)이 다른 상품**(운영 DB)
 * ```
 *
 * 🟢🟢 **새 입력을 만들지 않았다 — 정책은 «이미» 있었다.** `compute-readiness.ts:195`
 *    (대시보드 경로)가 **P0-D.3** 으로 같은 결정을 적어 뒀다:
 *    「『국내 동일상품을 찾았다』는 **EXACT 버킷에서만** 참이다」.
 *    🔴 상세 경로만 그것을 따르지 않아 **대시보드와 상품 상세가 다른 판정** 을 냈다.
 * 🟢 `basis === "EXACT"` ⟺ `exact.sellerCount > 0` 은 **정의상 동치** 다(`:644`).
 *
 * 🔴 **COMPARISON 을 버리지 않는다** — 참고가격·후보 목록·축 A 추천가·축 B 마진 **불변**.
 */
const MI_SRC = join(process.cwd(), "src/app/api/price-history/_lib/market-intelligence.ts");
const READINESS_SRC = join(process.cwd(), "src/app/api/snapshots/_lib/compute-readiness.ts");
/** 🔴 주석을 벗긴다 — 주석의 글자가 통과시키는 함정(이 저장소에서 여덟 번). */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const MI = strip(readFileSync(MI_SRC, "utf8"));
const READINESS = strip(readFileSync(READINESS_SRC, "utf8"));

const COST = 67_290;
const PRICE = 88_000;

/** 🟢 운영 호출부 인자를 그대로 베낀다(복제식 금지 — 같은 함수를 같은 모양으로 부른다). */
function sellabilityFor(basis: "EXACT" | "COMPARISON" | "NONE") {
  const exact =
    basis === "EXACT" ? { sellerCount: 1, averagePriceKrw: PRICE } : { sellerCount: 0, averagePriceKrw: null };
  const r = computeSellability({
    costPriceKrw: COST,
    domestic: { matched: exact.sellerCount > 0, averagePriceKrw: exact.averagePriceKrw },
  } as never);
  return r.level;
}

function representativeFor(basis: "EXACT" | "COMPARISON" | "NONE") {
  const has = basis !== "NONE";
  const s = computeSellability({
    costPriceKrw: COST,
    domestic:
      basis === "EXACT" ? { matched: true, averagePriceKrw: PRICE } : { matched: false, averagePriceKrw: null },
  } as never);
  const r = deriveRepresentativeSellerVerdict({
    unifiedDecision: null,
    sellability: s,
    /** 🔴 resolved 기준 — 이 칸은 **바꾸지 않았다**(판정 owner 가 basis 를 같이 받는다). */
    domesticMatched: has,
    domesticSellerCount: has ? 1 : 0,
    domesticBasis: basis,
  } as never);
  return r.code;
}

describe("MI-SELLABILITY-BASIS-GATE", () => {
  /* ─────────────── A. 배선 — EXACT 버킷을 읽는다 ─────────────── */

  it("A-1 🔴 상세 경로가 `exact` 버킷을 읽는다(추정 승격 차단)", () => {
    const block = MI.slice(MI.indexOf("computeSellability({"), MI.indexOf("computeSellability({") + 320);
    expect(block).toContain("matched: domesticMarketSplit.exact.sellerCount > 0");
    expect(block).toContain("averagePriceKrw: domesticMarketSplit.exact.averagePriceKrw");
    /** 🔴 `resolved` 로 되돌아가면 PRESUMED 가 다시 GREEN 을 만든다. */
    expect(block).not.toContain("resolved.sellerCount");
    expect(block).not.toContain("resolved.averagePriceKrw");
  });

  it("A-2 🟢 두 호출부가 **같은 정책**을 쓴다 — owner 가 갈리지 않는다", () => {
    /**
     * 🔴 대시보드(`compute-readiness`)와 상품 상세(`market-intelligence`)가 다른 버킷을
     *    읽으면 같은 상품이 두 화면에서 다른 판정을 받는다(이번에 고친 그 구멍).
     */
    expect(READINESS).toContain("matched: domesticSplit.exact.sellerCount > 0");
    expect(MI).toContain("matched: domesticMarketSplit.exact.sellerCount > 0");
  });

  /* ─────────── B. 결과 — 세 조건의 산출(순수 함수) ─────────── */

  it("B-1 🟢 EXACT 는 기존 결과가 보존된다", () => {
    expect(sellabilityFor("EXACT")).toBe("GREEN");
    expect(representativeFor("EXACT")).toBe("READY");
  });

  it("B-2 🔴 COMPARISON(PRESUMED 한 건)은 GREEN 으로 승격되지 않는다", () => {
    expect(sellabilityFor("COMPARISON")).toBe("YELLOW");
    /** 🔴 확정 추천(`READY`)이 아니어야 한다 — CPO 완료 기준. */
    expect(representativeFor("COMPARISON")).not.toBe("READY");
    /**
     * 🔴🔴 **이 줄이 왜 여기 있는가 — 음성 대조가 구멍을 찾았다.**
     *    위 두 단언은 순수 함수를 **직접** 부르므로 **운영 배선이 끊겨도 통과** 한다
     *    (M4 변이에서 B 군 7건이 그대로 passed 였다 · 이 저장소가 WU-110 에서 밟은 함정).
     * 🟢 그래서 **그 결과를 만드는 배선** 을 같은 케이스에서 같이 문다.
     */
    expect(
      MI,
      "🔴 운영이 resolved 를 읽으면 이 B-2 가 말하는 YELLOW 가 화면에서 GREEN 이 된다",
    ).toContain("matched: domesticMarketSplit.exact.sellerCount > 0");
  });

  it("B-3 🟢 NONE 은 기존 보수적 동작이 보존된다", () => {
    expect(sellabilityFor("NONE")).toBe("YELLOW");
    expect(representativeFor("NONE")).toBe("MARKET_OPPORTUNITY");
  });

  it("B-4 🔴 COMPARISON 과 NONE 이 **같은 등급** 이다 — 추정은 근거로 치지 않는다", () => {
    expect(sellabilityFor("COMPARISON")).toBe(sellabilityFor("NONE"));
    expect(representativeFor("COMPARISON")).toBe(representativeFor("NONE"));
  });

  /* ─────────── C. 보존 — 다른 축은 건드리지 않았다 ─────────── */

  it("C-1 🟢 축 A(추천가)·축 B(마진)·참고가격 배선이 그대로다", () => {
    /** 축 A — basis 게이트 그대로. */
    expect(MI).toContain("domesticBasis: domesticMarketSplit.basis");
    /** 축 B — 마진 근거 분리 유지(MARGIN-BASIS-SPLIT-01). */
    expect(MI).toContain("referencePriceKrw: marginBasisSummary.byCurrency.KRW?.lowestAmount");
    /** 참고가격 — 옛 집계 그대로. */
    expect(MI).toContain("candidateDomesticPrice: domesticCandidatePriceSummary,");
  });

  it("C-2 🔴 `domesticSummary`(resolved)를 쓰는 다른 소비자는 **그대로** 다", () => {
    /**
     * 🔴 이번 변경은 `computeSellability` **한 호출부** 뿐이다. `sellerAction` 과
     *    `computePriceDecision` 은 `domesticSummary` 를 계속 읽는다 — 그 둘을 같이
     *    바꾸면 CPO 가 금지한 범위 확대가 된다.
     * 🟡 `sellerAction` 은 basis 를 받지 않는다는 사실이 **남아 있다**(미측정 위험으로 보고됨).
     */
    expect(MI).toContain("lowestPriceKrw: domesticSummary.lowestPriceKrw");
    expect(MI).toContain("domesticLowestPriceKrw: domesticSummary.lowestPriceKrw");
  });

  it("C-3 🟢 SAME 판정 축을 건드리지 않았다", () => {
    expect(MI).not.toContain("SAME_MIN_AXES");
    expect(MI).not.toContain("compareCrossSellerProducts");
  });
});
