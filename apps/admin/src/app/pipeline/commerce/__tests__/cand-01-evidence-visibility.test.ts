import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  selectCandidateList,
  selectMiSameCandidates,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-EVIDENCE-VISIBILITY-01 — **가격 후보 ⊆ 화면 후보**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CEO 모순: 「동일하다고 **가격은 뜨는데** 후보군 리스트가 안 보인다」.
 *    같은 Candidate 를 **두 기준** 으로 걸러낸 제품 구조 문제였다.
 * 🔴 `CAND-07` 이 이 파일의 핵심이다 — **가격 배열의 행이 화면 배열에서 사라지면 FAIL.**
 * 🔴 가격 **집계** 정책은 변경 0(CPO §4-B·§8) — 넓힌 것은 **표시** 뿐이다.
 */

const r = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    domain: "x.com",
    title: "Hug Hairy Monster T-shirt",
    discoveredUrl: `https://x.com/${Math.abs(JSON.stringify(over).length)}-${over.domain ?? "d"}`,
    market: "OVERSEAS",
    soldOut: false,
    priceStatus: "VERIFIED_CURRENT",
    ...over,
  }) as GeminiTransientRow;

const list = (rows: GeminiTransientRow[]): string[] =>
  selectCandidateList(rows, "OVERSEAS").map((x) => x.row.domain);
const group = (rows: GeminiTransientRow[], domain: string): string | undefined =>
  selectCandidateList(rows, "OVERSEAS").find((x) => x.row.domain === domain)?.group;

describe("CANDIDATE-EVIDENCE-VISIBILITY-01", () => {
  /** 🟢 CAND-01 — SAME + 가격 ⟹ 리스트 + 가격. */
  it("CAND-01 SAME + 가격 존재", () => {
    const rows = [r({ domain: "a.com", matchTruth: "EXACT_IDENTIFIER", priceAmount: 37, priceCurrency: "GBP" })];
    expect(list(rows)).toEqual(["a.com"]);
    expect(group(rows, "a.com")).toBe("LIKELY");
    /** 🟢 그리고 가격 축에도 그대로 있다 — 두 축이 **같은 Candidate** 다. */
    expect(selectMiSameCandidates(rows, "OVERSEAS").priced.map((x) => x.domain)).toEqual(["a.com"]);
  });

  /** 🟢 CAND-02 — PRESUMED_SAME + 가격 ⟹ 리스트. */
  it("CAND-02 PRESUMED_SAME + 가격 존재", () => {
    const rows = [r({ domain: "b.com", crossSellerVerdict: "PRESUMED_SAME", priceAmount: 58, priceCurrency: "USD" })];
    expect(list(rows)).toEqual(["b.com"]);
    expect(group(rows, "b.com")).toBe("LIKELY");
  });

  /**
   * 🔴🔴 CAND-03 — **SAME 인데 가격이 없어도 리스트에 선다.**
   *    🔴 전까지 이 행은 가격 축에서 빠지면서 표시 축에도 없어 **사라졌다**.
   */
  it("CAND-03 SAME + 가격 없음 ⟹ 리스트에 남는다", () => {
    const rows = [r({ domain: "c.com", matchTruth: "EXACT_IDENTIFIER", priceAmount: null, priceCurrency: null })];
    expect(list(rows)).toEqual(["c.com"]);
    /** 🔴 가격 축에는 **안 들어간다** — 집계 정책은 그대로다. */
    expect(selectMiSameCandidates(rows, "OVERSEAS").priced).toHaveLength(0);
  });

  /** 🟡 CAND-04 — SIMILAR + Evidence 충분 ⟹ 리스트(확장 군). */
  it("CAND-04 SIMILAR + Evidence 충분", () => {
    const rows = [r({ domain: "d.com", matchTruth: "SIMILAR", priceAmount: 40, priceCurrency: "EUR" })];
    expect(list(rows)).toEqual(["d.com"]);
    expect(group(rows, "d.com")).toBe("POSSIBLE");
  });

  /** 🔴 CAND-05/06 — DIFFERENT·CONFLICT 는 주 리스트에서 제외. */
  it("CAND-05·06 CONFLICT / 판정 없음은 제외", () => {
    expect(list([r({ domain: "e.com", crossSellerVerdict: "CONFLICT" })])).toEqual([]);
    expect(list([r({ domain: "f.com", matchTruth: "CONFLICT" })])).toEqual([]);
    /** 🔴 판정을 못 낸 행도 **지어내지 않는다**. */
    expect(list([r({ domain: "g.com", matchTruth: null, crossSellerVerdict: null })])).toEqual([]);
  });

  /** 🔴 CAND-06-b — Evidence 가 사실상 없는 UNKNOWN 은 제외(CPO §4-C). */
  it("CAND-06-b Evidence 없는 후보는 제외", () => {
    const bare = r({ domain: "h.com", crossSellerVerdict: "SIMILAR", matchTruth: null, title: undefined });
    expect(list([bare])).toEqual([]);
    /** 🟢 이유가 하나라도 적혔으면 셀러가 눈으로 가릴 수 있다 ⟹ 들어온다. */
    const withReason = r({
      domain: "i.com",
      crossSellerVerdict: "SIMILAR",
      matchTruth: null,
      matchReasons: ["핵심 상품명 일부 일치"],
    });
    expect(list([withReason])).toEqual(["i.com"]);
  });

  /**
   * 🔴🔴🔴 **CAND-07 — 이 파일의 핵심.**
   *    가격 배열(`priced`)의 모든 행은 화면 배열에 **반드시 있다.**
   *    🔴 어느 한쪽에만 필터를 더하는 순간 여기서 FAIL 한다.
   */
  it("CAND-07 가격 후보가 화면 후보에서 사라지지 않는다", () => {
    const rows = [
      r({ domain: "a.com", matchTruth: "EXACT_IDENTIFIER", priceAmount: 37, priceCurrency: "GBP" }),
      r({ domain: "b.com", crossSellerVerdict: "PRESUMED_SAME", priceAmount: 58, priceCurrency: "USD" }),
      r({ domain: "c.com", matchTruth: "SIMILAR", priceAmount: 40, priceCurrency: "EUR" }),
      r({ domain: "d.com", crossSellerVerdict: "CONFLICT", priceAmount: 9, priceCurrency: "EUR" }),
      r({ domain: "e.com", matchTruth: "EXACT_IDENTIFIER", soldOut: true, priceAmount: 1, priceCurrency: "GBP" }),
      r({
        domain: "f.com",
        matchTruth: "EXACT_IDENTIFIER",
        priceStatus: "UNVERIFIED_SEARCH",
        priceAmount: 2,
        priceCurrency: "GBP",
      }),
      r({ domain: "g.com", market: "KR", matchTruth: "EXACT_IDENTIFIER", priceAmount: 88000, priceCurrency: "KRW" }),
    ];
    for (const market of ["KR", "OVERSEAS"] as const) {
      const priced = selectMiSameCandidates(rows, market).priced;
      const shown = new Set(selectCandidateList(rows, market).map((x) => x.row.discoveredUrl));
      for (const p of priced) {
        expect(
          shown.has(p.discoveredUrl),
          `🔴 ${market} — 가격이 뜨는 후보(${p.domain})가 후보 리스트에서 사라졌다`,
        ).toBe(true);
      }
      /** 🟢 분모가 0 이면 이 단언은 공짜다 — 그래서 **가격 후보가 있었다** 는 것도 적는다. */
      expect(priced.length).toBeGreaterThan(0);
    }
  });

  /** 🔴 CAND-08 — 품절·가격미확인 SAME 도 리스트에 남는다(사라지지 않는다). */
  it("CAND-08 품절·가격미확인 SAME 이 리스트에 남는다", () => {
    const sold = r({ domain: "s.com", matchTruth: "EXACT_IDENTIFIER", soldOut: true, priceAmount: 1, priceCurrency: "GBP" });
    const unver = r({
      domain: "u.com",
      matchTruth: "EXACT_IDENTIFIER",
      priceStatus: "UNVERIFIED_SEARCH",
      priceAmount: 2,
      priceCurrency: "GBP",
    });
    expect(list([sold, unver]).sort()).toEqual(["s.com", "u.com"]);
    /** 🔴 그러나 가격 집계에는 **안 들어간다** — 그 정책은 변경 0이다. */
    expect(selectMiSameCandidates([sold, unver], "OVERSEAS").priced).toHaveLength(0);
  });

  /**
   * 🔴🔴🔴 **CAND-10 — 「후보군 확대」가 「가격 집계 확대」가 아니다**(CPO §6·§11 마지막 변이).
   *    🔴 내 변이 M7 이 이 구멍을 찾았다 — 가격 선별기의 `SAME` 요구를 느슨하게 해도
   *       CAND 파일이 **통과했다**. 🟢 그래서 그 축을 **여기서 직접** 문다.
   *    🔴 「화면 후보를 가격 후보로 승격」하는 순간 FAIL 한다.
   */
  it("CAND-10 화면 확대가 가격 집계를 넓히지 않는다", () => {
    const rows = [
      r({ domain: "p1.com", crossSellerVerdict: "PRESUMED_SAME", priceAmount: 58, priceCurrency: "USD" }),
      r({ domain: "p2.com", matchTruth: "SIMILAR", priceAmount: 40, priceCurrency: "EUR" }),
      r({ domain: "p3.com", crossSellerVerdict: "CONFLICT", priceAmount: 9, priceCurrency: "EUR" }),
    ];
    /** 🟢 셋 중 둘은 **화면에** 선다(확장). */
    expect(list(rows).sort()).toEqual(["p1.com", "p2.com"]);
    /** 🔴 그러나 **가격 집계에는 하나도 들어가지 않는다** — SAME 이 아니다. */
    expect(selectMiSameCandidates(rows, "OVERSEAS").priced).toHaveLength(0);
    /** 🔴 그리고 그 요구가 **코드에 남아 있는지** 까지 본다(행동 + 앵커 두 축). */
    const src = readFileSync(join(__dirname, "..", "mi-same-candidates.ts"), "utf8");
    const at = src.indexOf("export function selectMiSameCandidates");
    expect(at).toBeGreaterThan(0);
    expect(src.slice(at, at + 2600)).toContain('transientDisplayTier(row) !== "SAME"');
  });

  /** 🔴 CAND-09 — 시장이 섞이지 않고 같은 URL 은 한 번만. */
  it("CAND-09 시장 분리 · URL 중복 제거", () => {
    const kr = r({ domain: "k.kr", market: "KR", matchTruth: "EXACT_IDENTIFIER" });
    expect(selectCandidateList([kr], "OVERSEAS")).toHaveLength(0);
    expect(selectCandidateList([kr, { ...kr }], "KR")).toHaveLength(1);
  });
});
