import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isEvidenceEvaluationWorthwhile } from "../run-domestic-price-check";
import type { ComparisonCandidate } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-IDENTITY-PRICE-01 — **⑧ 게이트가 버린 후보를 살린다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO §8 「Candidate를 과도하게 제거하지 말 것」:
 * ```
 * Evidence 부족  ≠  무조건 삭제
 * SAME이 아님    ≠  무조건 가치 없음
 * ```
 *
 * 🔴 실측(10상품 · 새 Search 0) — MI 자격 **18 → 최종 4**(-14 · 78%)가
 *    `isEvidenceEvaluationWorthwhile` 뒤의 `continue` 에서 사라졌다.
 * 🔴 CEO 육안 GT 는 그 버림 «안에» **Human SAME 3건** 이 있었다고 했다(WU-112).
 *
 * 🔴🔴 이 파일이 지키는 것은 **둘이고 서로 반대 방향** 이다:
 *    ⒜ 버려진 후보가 **보인다**(§8)
 *    ⒝ 그 후보가 **가격/판정에는 들어가지 않는다**(WU-097 sink 경계)
 *    둘 중 하나만 지키면 각각 「후보가 사라진다」·「가격이 오염된다」가 된다.
 */

const LIB = join(__dirname, "..");
const RUNNER = readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8").replace(/\r\n/g, "\n");
const CHECK_ROUTE = readFileSync(join(LIB, "../check/route.ts"), "utf8").replace(/\r\n/g, "\n");

/** 🔴 주석을 벗긴다 — 메모 `source-scan-must-strip-comments`(여덟 번 걸린 함정). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}
const RUNNER_CODE = stripComments(RUNNER);
const ROUTE_CODE = stripComments(CHECK_ROUTE);

function candidate(over: Partial<ComparisonCandidate>): ComparisonCandidate {
  return {
    url: "https://shop.example.com/products/x",
    title: "Some Product Title",
    price: null,
    currency: null,
    imageUrl: null,
    sku: null,
    matchLevel: "low",
    matchConfidence: 0.1,
    matchReasons: [],
    ...over,
  } as unknown as ComparisonCandidate;
}

describe("DIP-01 A — ⑧ 게이트의 «실제» 성질(운영 함수 직접 호출)", () => {
  /**
   * 🔴🔴 이 단언이 이 WU 의 출발점이다. 게이트는 **비용** 게이트인데 그 뒤에
   *    `continue` 가 있어 **노출까지** 결정하고 있었다.
   */
  it("A-1 🔴 SIMILAR · UNKNOWN · CONFLICT · 판정없음은 전부 DROPPED 된다", () => {
    for (const v of ["SIMILAR", "UNKNOWN", "CONFLICT"] as const) {
      expect(
        isEvidenceEvaluationWorthwhile([candidate({ crossSellerVerdict: v })], null, "shop.example.com"),
        `${v} 가 통과하면 이 WU 의 전제가 바뀐 것이다`,
      ).toBe(false);
    }
    expect(isEvidenceEvaluationWorthwhile([candidate({})], null, "shop.example.com")).toBe(false);
  });

  it("A-2 🟢 SAME / PRESUMED_SAME 은 통과한다(기존 동작 불변)", () => {
    for (const v of ["SAME", "PRESUMED_SAME"] as const) {
      expect(isEvidenceEvaluationWorthwhile([candidate({ crossSellerVerdict: v })], null, "x.com")).toBe(true);
    }
  });

  /** 🔴 비용 게이트의 원래 목적은 그대로다 — 이 WU 가 게이트 «자체» 를 완화하지 않았다. */
  it("A-3 🔴 게이트를 완화하지 «않았다» — 통과 조건이 그대로다", () => {
    const fn = RUNNER_CODE.slice(
      RUNNER_CODE.indexOf("export function isEvidenceEvaluationWorthwhile"),
      RUNNER_CODE.indexOf("export function orderByCrossSellerVerdict"),
    );
    expect(fn).toContain('crossSellerVerdict === "SAME"');
    expect(fn).toContain('candidates[0].matchLevel !== "low"');
    expect(fn).toContain("confirmBrandCodeInTitle");
  });
});

describe("DIP-01 B — 버려진 후보가 «보인다»", () => {
  it("B-1 🟢 DROPPED 분기가 `weakCandidateEvidence` 에 push 한다", () => {
    const branch = RUNNER_CODE.slice(
      RUNNER_CODE.indexOf('if (judgement.kind === "DROPPED")'),
      RUNNER_CODE.indexOf("const {\n      best,"),
    );
    expect(branch.length).toBeGreaterThan(100);
    expect(branch, "버려진 후보를 담는 줄이 사라졌다 — 다시 화면에서 사라진다").toContain(
      "weakCandidateEvidence.push({",
    );
    /** 🔴 어느 게이트가 버렸는지 — 「후보가 없었다」와 구분한다. */
    expect(branch).toContain("dropGate: judgement.gate");
    /** 🔴 출처 배지가 빈칸이 되면 안 된다. */
    expect(branch).toContain("source: evidenceSource");
  });

  it("B-2 🟢 응답이 그 배열을 내보낸다", () => {
    expect(RUNNER_CODE).toContain("weakCandidateEvidence,");
    expect(RUNNER_CODE).toContain("weakCandidateEvidence?: WeakCandidateEvidence[] | null;");
  });

  /**
   * 🔴🔴 **비용 게이트의 목적을 되돌리지 않았다.** 이 경로는 품번 fetch 를 하지 않는다 —
   *    그것이 ⑧ 이 존재하는 이유이고, 여기서 부르면 게이트를 사실상 없앤 것이 된다.
   */
  it("B-3 🔴 DROPPED 경로에서 **추가 HTTP 를 하지 않는다**", () => {
    const branch = RUNNER_CODE.slice(
      RUNNER_CODE.indexOf('if (judgement.kind === "DROPPED")'),
      RUNNER_CODE.indexOf("const {\n      best,"),
    );
    for (const w of ["fetchDomesticModelCode", "enrichCandidatePrices", "await fetch", "factsFromProductUrl"]) {
      expect(branch, `DROPPED 경로가 ${w} 를 부른다 — 비용 게이트가 무력화된다`).not.toContain(w);
    }
  });
});

describe("DIP-01 C — 🔴🔴 가격·판정에는 «들어가지 않는다»(WU-097 경계)", () => {
  /**
   * 🔴🔴🔴 이 계약이 이 WU 에서 가장 중요하다. `transientEvidence` 는 MI 집계 입력이고
   *    (`market-intelligence.ts`) 거기에 판정 없는 후보를 넣으면 **가격 집계가 오염된다**.
   */
  it("C-1 🔴 `/check` 의 MI 인자에 **들어 있지 않다**", () => {
    const merge = ROUTE_CODE.slice(
      ROUTE_CODE.indexOf("const transientEvidence ="),
      ROUTE_CODE.indexOf("intelligence = await computeMarketIntelligence("),
    );
    expect(merge.length).toBeGreaterThan(100);
    expect(merge, "🔴 버려진 후보가 MI 집계 입력에 들어갔다 — 가격이 오염된다").not.toContain(
      "weakCandidateEvidence",
    );
    /** 🟢 기존 여섯 배열은 그대로 들어간다(이 WU 가 그것을 빼지 않았다). */
    for (const a of [
      "geminiEvidence",
      "urlCandidateEvidence",
      "overseasAutoEvidence",
      "reviewedSameEvidence",
      "domesticListingEvidence",
      "webSearchEvidence",
    ]) {
      expect(merge).toContain(`...(domesticShop.${a} ?? [])`);
    }
  });

  /**
   * 🔴🔴 **타입 수준 방어** — 칸이 없으면 집계에 넣는 길이 구조적으로 없다.
   *    🔴 WU-085 에서 `priceTierFromLink({matchTruth:null,verified:false})` 를 지어넣었다가
   *       「측정불가」로 되돌린 적이 있다. 그 재발을 타입으로 막는다.
   */
  it("C-2 🔴🔴 `WeakCandidateEvidence` 에 판정/가격 자격 칸이 **없다**", () => {
    const decl = RUNNER_CODE.slice(
      RUNNER_CODE.indexOf("export interface WeakCandidateEvidence"),
      RUNNER_CODE.indexOf("export interface DomesticPriceCheckResult"),
    );
    expect(decl.length).toBeGreaterThan(100);
    for (const f of ["priceTier", "priceKrw", "matchTruth", "verified", "matchType"]) {
      expect(decl, `🔴 ${f} 칸이 생겼다 — 그 값은 «지어낸» 값이고 가격 집계로 가는 문이 열린다`).not.toContain(
        `${f}:`,
      );
    }
    /** 🟢 반대로, 표시에 필요한 칸은 있어야 한다. */
    for (const f of ["dropGate:", "crossSellerVerdict:", "discoveredUrl:", "market:"]) {
      expect(decl).toContain(f);
    }
  });

  /** 🔴 `priceTierFromLink` 를 DROPPED 경로에서 부르지 않는다(값을 만들지 않는다). */
  it("C-3 🔴 버려진 후보의 tier 를 **만들지 않는다**", () => {
    const branch = RUNNER_CODE.slice(
      RUNNER_CODE.indexOf('if (judgement.kind === "DROPPED")'),
      RUNNER_CODE.indexOf("const {\n      best,"),
    );
    expect(branch).not.toContain("priceTierFromLink");
    expect(branch).not.toContain("priceTierWithVerifiedSame");
  });

  /** 🟢 시장은 **운영 owner** 를 그대로 부른다 — 여기서 추측하지 않는다. */
  it("C-4 🟢 market 은 `classifyCandidateMarket` 산출이다(복제 0)", () => {
    const branch = RUNNER_CODE.slice(
      RUNNER_CODE.indexOf('if (judgement.kind === "DROPPED")'),
      RUNNER_CODE.indexOf("const {\n      best,"),
    );
    expect(branch).toContain("...classifyCandidateMarket({");
  });
});
