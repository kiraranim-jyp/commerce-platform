import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeCandidateOverseasPrices, type CandidateOverseasPriceRecord } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 3 P1 — **「유사상품」 가격은 «동일상품 최저 확인가» 가 아니다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **실측에서 나온 계약이다**(추정 아님). B226AC010 을 운영 함수로 돌린 결과:
 * ```
 * 집계 진입 15  ·  verdict {PRESUMED_SAME 9 · SAME 5 · **SIMILAR 1**}
 *                tier    {COMPARISON 9 · EXACT 5 · **REFERENCE 1**}
 * 🔴 그 SIMILAR 1건(`milanik.tw` TWD 2,980)이 **TWD 최저 확인가** 였다
 * ```
 * 🔴 CEO 가 B226AC043 에서 본 `CAD 26,300` 과 **같은 자리** 다.
 *
 * 🔴 **네트워크 0 · DB 0** — 순수 함수와 소스 앵커만 본다(회귀에서 매번 돈다).
 */

const SRC_AGG = readFileSync(join(__dirname, "..", "candidate-market.ts"), "utf8");
const SRC_INTEL = readFileSync(join(__dirname, "..", "market-intelligence.ts"), "utf8");
/** 🔴 주석을 벗긴다 — 이 저장소가 여덟 번 걸린 함정이다. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const AGG = strip(SRC_AGG);
const INTEL = strip(SRC_INTEL);

const os = (
  verdict: string | null | undefined,
  tier: string,
  amount: number,
  currency = "USD",
): CandidateOverseasPriceRecord => ({
  market: "OVERSEAS",
  currency,
  amount,
  priceTier: tier,
  ...(verdict === undefined ? {} : { verdict }),
});

describe("SPRINT 3 P1 — 가격 집계 자격(verdict)", () => {
  /* ── A. 실측 재현 — 그 한 건이 최저가가 되지 못한다 ───────────────────── */
  it("A-1 🔴 SIMILAR(유사상품)의 금액은 byCurrency 에 들어가지 않는다", () => {
    const s = summarizeCandidateOverseasPrices([os("SIMILAR", "REFERENCE", 2980, "TWD")]);
    expect(s.byCurrency.TWD).toBeUndefined();
  });

  it("A-2 🟢 관측은 지우지 않는다 — byMarket·byPriceTier·count 는 그대로 센다", () => {
    const s = summarizeCandidateOverseasPrices([os("SIMILAR", "REFERENCE", 2980, "TWD")]);
    expect(s.count).toBe(1);
    expect(s.byMarket).toEqual({ OVERSEAS: 1 });
    expect(s.byPriceTier).toEqual({ REFERENCE: 1 });
  });

  it("A-3 🔴 실측 구성 그대로 — SIMILAR 1건만 빠지고 나머지 14건은 유지된다", () => {
    const recs: CandidateOverseasPriceRecord[] = [
      os("PRESUMED_SAME", "COMPARISON", 50),
      os("PRESUMED_SAME", "COMPARISON", 50),
      os("SAME", "EXACT", 58),
      os("SAME", "EXACT", 58),
      os("PRESUMED_SAME", "COMPARISON", 32, "EUR"),
      os("SAME", "EXACT", 7590, "JPY"),
      os("SIMILAR", "REFERENCE", 2980, "TWD"),
    ];
    const s = summarizeCandidateOverseasPrices(recs);
    expect(s.byCurrency.USD).toEqual({ count: 4, lowestAmount: 50, highestAmount: 58 });
    expect(s.byCurrency.EUR?.lowestAmount).toBe(32);
    expect(s.byCurrency.JPY?.lowestAmount).toBe(7590);
    /** 🔴 TWD 축이 **아예 서지 않는다** — 그 통화의 유일한 근거가 유사상품이었다. */
    expect(s.byCurrency.TWD).toBeUndefined();
    expect(s.count).toBe(7);
  });

  /* ── B. 허용 집합 — 🔴 SAME 으로 좁히지 않는다 ───────────────────────── */
  it("B-1 🟢 SAME 과 PRESUMED_SAME 은 «둘 다» 1차 가격에 들어간다", () => {
    for (const v of ["SAME", "PRESUMED_SAME"]) {
      const s = summarizeCandidateOverseasPrices([os(v, "COMPARISON", 100)]);
      expect(s.byCurrency.USD?.lowestAmount, `${v} 가 빠지면 Recall 회귀다`).toBe(100);
    }
  });

  it("B-2 🔴 UNKNOWN·CONFLICT 도 금액에서 빠진다", () => {
    for (const v of ["UNKNOWN", "CONFLICT"]) {
      expect(summarizeCandidateOverseasPrices([os(v, "COMPARISON", 10)]).byCurrency.USD).toBeUndefined();
    }
  });

  it("B-3 🔴🔴 PRESUMED_SAME 을 막으면 age-line recall 이 닫힌다 — 그 경로를 보호한다", () => {
    /** `AGE-LINE-POLICY-01` 이 AB↔AC 를 **의도적으로** 보류 등급으로 둔다. */
    const s = summarizeCandidateOverseasPrices([os("PRESUMED_SAME", "COMPARISON", 37, "GBP")]);
    expect(s.byCurrency.GBP?.lowestAmount).toBe(37);
  });

  /* ── C. 🔴 국내 축 회귀 금지(CPO ④) ─────────────────────────────────── */
  it("C-1 🔴 verdict 를 «넘기지 않으면» 동작이 한 글자도 바뀌지 않는다", () => {
    const kr: CandidateOverseasPriceRecord[] = [
      { market: "KR", currency: "KRW", amount: 88_000, priceTier: "COMPARISON", sellerKey: "a.kr" },
      { market: "KR", currency: "KRW", amount: 92_000, priceTier: "EXACT", sellerKey: "b.kr" },
    ];
    const s = summarizeCandidateOverseasPrices(kr);
    expect(s.byCurrency.KRW).toEqual({ count: 2, lowestAmount: 88_000, highestAmount: 92_000 });
  });

  it("C-2 🔴 null(판정을 거친 적 없음)은 막지 않는다 — 「모르는 것」으로 가격을 지우지 않는다", () => {
    expect(summarizeCandidateOverseasPrices([os(null, "COMPARISON", 70)]).byCurrency.USD?.lowestAmount).toBe(70);
  });

  it("C-3 🔴 EXCLUDED 제외는 그대로 산다(WU-062)", () => {
    const s = summarizeCandidateOverseasPrices([os("SAME", "EXCLUDED", 9), os("SAME", "EXACT", 40)]);
    expect(s.byCurrency.USD?.lowestAmount).toBe(40);
  });

  it("C-4 🟢 판매처 접힘(sellerKey)과 같이 써도 깨지지 않는다", () => {
    const s = summarizeCandidateOverseasPrices([
      { market: "OVERSEAS", currency: "USD", amount: 50, priceTier: "COMPARISON", verdict: "SAME", sellerKey: "x.com" },
      { market: "OVERSEAS", currency: "USD", amount: 60, priceTier: "COMPARISON", verdict: "SAME", sellerKey: "x.com" },
      { market: "OVERSEAS", currency: "USD", amount: 20, priceTier: "REFERENCE", verdict: "SIMILAR", sellerKey: "y.com" },
    ]);
    expect(s.byCurrency.USD).toEqual({ count: 1, lowestAmount: 50, highestAmount: 50 });
  });

  /* ── D. 배선 — 🔴 판정 함수만 부르면 배선이 끊겨도 통과한다(WU-110 교훈) ── */
  it("D-1 🔴 해외 생산자가 verdict 를 싣는다", () => {
    const at = INTEL.indexOf("overseasEvidence.push({");
    expect(at).toBeGreaterThan(0);
    expect(INTEL.slice(at, at + 420)).toContain("verdict: e.crossSellerVerdict");
  });

  it("D-2 🔴🔴 국내 생산자는 verdict 를 싣지 «않는다»(국내 회귀 방어)", () => {
    const at = INTEL.indexOf("domesticTransientRecords.push({");
    expect(at).toBeGreaterThan(0);
    expect(INTEL.slice(at, at + 420)).not.toContain("verdict");
  });

  it("D-3 🔴 자격 집합은 상수 하나가 소유한다 · SAME 단독으로 좁히지 않는다", () => {
    expect(AGG).toContain("PRICE_ELIGIBLE_VERDICTS");
    expect(AGG).toMatch(/PRICE_ELIGIBLE_VERDICTS\s*=\s*new Set\(\["SAME",\s*"PRESUMED_SAME"\]\)/);
    expect(AGG).toContain("PRICE_ELIGIBLE_VERDICTS.has(r.verdict)");
  });

  it("D-4 🔴 verdict 가 없을 때를 막지 않는다(`!= null` 가드가 살아 있다)", () => {
    expect(AGG).toContain("r.verdict != null && !PRICE_ELIGIBLE_VERDICTS.has(r.verdict)");
  });
});
