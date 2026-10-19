import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-097 — **sink 경계를 «현재 성질 그대로» 잠근다** (네트워크 0 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시 2026-10-19: 「분리가 안전하지 않다면 **코드 변경 없이 REJECT/HOLD** 하고
 *    이유를 확정한다.」 ⟹ 이 파일은 **고치지 않고 «사실» 을 단언** 한다.
 *
 * ── 🔴🔴 이 계약이 잠그는 사실 둘 ─────────────────────────────────────────
 * ```
 * ① `DROPPED` 는 **sink 에 도달하지 않는다** (`continue` 가 앞에 있다)
 * ② sink 배열(`geminiEvidence`)은 **화면 전용이 아니다** — `computeMarketIntelligence`
 *    가 그것을 읽어 **가격 축에 적재** 한다
 * ```
 * 🔴 그래서 「sink 앞에서 후보를 보존한다」는 곧 **「가격 집계 입력에 넣는다」** 가 된다.
 * 🟢 나중에 누가 분리를 구현하면 **②의 단언이 FAIL 로 뒤집히고**, 그것이 수정의 증거다
 *    (쿠팡 고시 선례 · 헌장 §12).
 */

const RUNNER = path.join(__dirname, "../run-domestic-price-check.ts");
/** 🔴 주석을 벗기고 본다 — 이 리포에서 여덟 번 걸린 함정(헌장 §5). */
const src = readFileSync(RUNNER, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("WU-097 ① DROPPED 는 sink 앞에서 끊긴다", () => {
  it("🔴 `DROPPED` 분기가 `continue` 로 끝난다", () => {
    const i = src.indexOf('if (judgement.kind === "DROPPED")');
    expect(i).toBeGreaterThan(-1);
    const j = src.indexOf("transientEvidenceSink", i);
    const k = src.indexOf("continue;", i);
    expect(k).toBeGreaterThan(-1);
    /** 🔴 **continue 가 sink 보다 앞** 이어야 이 사실이 성립한다. */
    expect(k).toBeLessThan(j);
  });

  it("🔴 sink push 는 `JUDGED` 분해 **뒤** 에만 있다", () => {
    const push = src.indexOf("transientEvidenceSink.push");
    const judged = src.indexOf("} = judgement;");
    expect(push).toBeGreaterThan(judged);
    expect(judged).toBeGreaterThan(-1);
  });
});

describe("WU-097 ② sink 는 «가격 집계 입력» 이다 (화면 전용이 아니다)", () => {
  /**
   * 🔴🔴 **행동 단언을 시도했다가 «지웠다».** `computeMarketIntelligence` 를 직접 부르려면
   *    product snapshot / links 를 운영처럼 만들어야 하는데, 손으로 만든 입력은 집계 루프에
   *    **도달하지 못했다**(결과 불변). 🔴 그 상태로 「영향 없음」이라 적으면 **거짓** 이다 —
   *    이 트랙에서 입력을 지어내 틀린 적이 **세 번** 있다(WU-085 tier · WU-092 `as never` ·
   *    WU-094 인덱스). 🟢 그래서 **소스 수준의 «사실»** 만 단언하고 한계를 보고서에 적었다.
   */
  it("🔴🔴 집계 루프가 sink 배열을 순회하며 **가격 축에 push** 한다", () => {
    const mi = readFileSync(path.join(__dirname, "../market-intelligence.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const at = mi.indexOf("for (const e of geminiEvidence ?? [])");
    expect(at).toBeGreaterThan(-1);
    /** 🔴 「읽기만 한다」가 아니다 — 그 루프 **안** 에서 가격 축에 담는다. */
    expect(mi.slice(at, at + 2000)).toContain("overseasEvidence.push");
  });

  it("🔴 route 가 두 sink 를 **합쳐서** MI 에 넘긴다", () => {
    const route = readFileSync(path.join(__dirname, "../../check/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(route).toContain("domesticShop.geminiEvidence");
    expect(route).toContain("domesticShop.urlCandidateEvidence");
  });

  it("🔴 그러므로 «화면 보존» 과 «집계 투입» 이 지금은 **같은 배열** 이다", () => {
    const mi = readFileSync(path.join(__dirname, "../market-intelligence.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    /** 🔴 집계 루프가 그 배열을 **직접 순회** 한다. */
    expect(mi).toContain("for (const e of geminiEvidence ?? [])");
  });
});

describe("WU-097 ③ sink 타입은 «판정 없음» 을 표현하지 못한다", () => {
  it("🔴 `priceTier` 가 **필수** 다 — DROPPED 후보는 그 값을 만들 수 없다", () => {
    const decl = src.slice(src.indexOf("export interface GeminiTransientEvidence"));
    const body = decl.slice(0, decl.indexOf("\n}"));
    /** 🔴 `priceTier?:` 도 `| null` 도 아니다 ⟹ 지어내지 않으면 넣을 수 없다. */
    expect(body).toContain("priceTier: DomesticPriceTier;");
    expect(body).not.toContain("priceTier?:");
    expect(body).not.toContain("priceTier: DomesticPriceTier | null");
  });
});
