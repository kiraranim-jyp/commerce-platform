import { describe, expect, it } from "vitest";
import { deriveMatchTruth, MATCH_TRUTH_RANK, type MatchTruth } from "../match-truth";
import type { CrossSellerVerdict } from "../cross-seller";
import type { MatchLevel } from "../match";
import type { ModelEvidenceResult } from "../evidence";
// 🔴 가격 티어 규칙을 여기에 다시 적지 않는다. 이 저장소가 반복해서 다친 곳이
//    「같은 질문에 답하는 두 번째 기준」이라, 돈이 움직이는 칸은 운영 함수를
//    그대로 부른다(vitest 설정 하나에서 apps/admin 과 packages/crawler 를 함께
//    돌리므로 «@» 별칭이 이 파일에서도 그대로 산다 — apps/admin/vitest.config.ts:10).
import { priceTierFromLink } from "../../../../../apps/admin/src/app/api/domestic-price-sources/_lib/domestic-product-link";

/**
 * P0-A MATCHING ACCURACY — GOLDEN CASES(CEO 지시, 2026-09-17)
 *
 * ══ 이 파일이 무엇인가 ══════════════════════════════════════════════════════
 * **오늘의 동작을 고정한다. 「이래야 한다」가 아니라 「오늘 이렇다」다.**
 *
 * 🔴 이 테스트가 빨개지면 판정 우선순위가 바뀐 것이다. 약화시켜 통과시키지 말고,
 *    무엇을 왜 바꿨는지 먼저 적어라. 아래 표는 전부 «현재 코드가 실제로 내는 답»
 *    이고, 그중 몇 칸은 «사고»다(주석에 그렇게 표시해 두었다).
 *
 * ══ 왜 판정만으로는 부족한가 ════════════════════════════════════════════════
 * `EXACT_IDENTIFIER` 라는 낱말만 보면 그것이 돈에 무슨 일을 하는지 보이지 않는다.
 * 그래서 이 파일은 한 칸 더 간다:
 *
 *      (matchLevel, modelCode, crossSellerVerdict)
 *            └─ deriveMatchTruth ─→ MatchTruth ─→ priceTierFromLink ─→ tier
 *
 *      EXACT      = 🟢 동일상품 가격 버킷 (market-intelligence.ts:81)
 *      COMPARISON = 🟡 참고 시장가격 버킷
 *      EXCLUDED   = 가격 데이터 어디에도 쓰지 않는다 (run-domestic-price-check.ts:585)
 *
 * ══ 무엇이 충돌하는가(이 파일이 규명하려는 것) ══════════════════════════════
 * `deriveMatchTruth` 는 crossSeller 를 **CONFLICT 일 때만** 먼저 본다
 * (match-truth.ts:67). 그 한 줄을 지나면 modelCode(77-80줄)가 먼저 답을 내버려서,
 * 교차판매처 판정이 「같다고 확정하지 않았다」(PRESUMED_SAME/SIMILAR/UNKNOWN)고
 * 말해도 품번 하나로 동일상품 가격에 들어간다. 아래 CASE A/B/C 가 그 세 모양이다.
 */

const LEVELS: readonly MatchLevel[] = ["low", "medium", "high", "very_high"];

/** 판정 한 칸과 «그 판정이 돈에 하는 일» 한 칸을 함께 돌려준다. */
function judge(level: MatchLevel, modelCode: ModelEvidenceResult, crossSeller?: CrossSellerVerdict) {
  const truth = deriveMatchTruth(level, modelCode, crossSeller);
  // 저장되는 행은 verified 도 함께 갖는다. matchTruth 가 있으면 priceTierFromLink 는
  // verified 를 «보지 않는다»(domestic-product-link.ts:52-54) — 양쪽으로 확인한다.
  const tier = priceTierFromLink({ matchTruth: truth, verified: false });
  expect(priceTierFromLink({ matchTruth: truth, verified: true })).toBe(tier);
  return { truth, tier };
}

/* ═══════════════ ① CEO 가 지정한 네 케이스 × matchLevel 네 단계 ═══════════════ */

describe("P0-A ①: CASE A/B/C/D — 오늘의 판정과 오늘의 가격 티어", () => {
  /**
   * CASE A — modelCode=exact · crossSeller=PRESUMED_SAME
   *
   * 교차판매처 판정이 **「같다고 확정하지 않았다」**고 말한 쌍이다. 그런데도 네
   * 등급 전부에서 동일상품 가격(EXACT)에 들어간다. level 은 «어떤 이름표를 붙일지»
   * 만 가르고(STRONG vs EXACT_IDENTIFIER), 돈이 들어가는지 여부는 가르지 못한다.
   *
   * 🔴 이것이 실측 사고의 정체다 — junioredition.com 이 서로 다른 두 상품에 같은
   *    Product Code 를 적는 7쌍이 정확히 이 모양으로 EXACT 에 들어간다
   *    (identifier-safety.test.ts 「🔴 미해결」).
   */
  it("CASE A: exact + PRESUMED_SAME → 네 등급 전부 EXACT 티어", () => {
    expect(LEVELS.map((l) => judge(l, "exact", "PRESUMED_SAME"))).toEqual([
      { truth: "STRONG_IDENTIFIER", tier: "EXACT" }, // low
      { truth: "STRONG_IDENTIFIER", tier: "EXACT" }, // medium
      { truth: "EXACT_IDENTIFIER", tier: "EXACT" }, // high
      { truth: "EXACT_IDENTIFIER", tier: "EXACT" }, // very_high
    ]);
  });

  /**
   * CASE B — modelCode=partial · crossSeller=SIMILAR
   *
   * 교차판매처 축이 「축 하나 정도만 맞는다」고 말한 쌍이다. partial 은 level 을
   * 아예 보지 않으므로(match-truth.ts:80) 네 등급이 한 칸으로 뭉개진다.
   *
   * 🔴 `compareModelCode` 의 partial 문턱은 **LCS ≥ 4 글자**다(model-code.ts:75).
   *    "26AC0" 같은 시즌 접두사가 우연히 겹치기만 해도 partial 이 된다.
   */
  it("CASE B: partial + SIMILAR → 네 등급 전부 STRONG_IDENTIFIER/EXACT", () => {
    expect(LEVELS.map((l) => judge(l, "partial", "SIMILAR"))).toEqual([
      { truth: "STRONG_IDENTIFIER", tier: "EXACT" },
      { truth: "STRONG_IDENTIFIER", tier: "EXACT" },
      { truth: "STRONG_IDENTIFIER", tier: "EXACT" },
      { truth: "STRONG_IDENTIFIER", tier: "EXACT" },
    ]);
  });

  /**
   * CASE C — modelCode=partial · crossSeller=UNKNOWN
   *
   * UNKNOWN 은 «맞는 축이 하나도 없었다»는 뜻이다(cross-seller.ts:653 — totalPoints 0).
   * 상품 증거가 0인데도 답은 CASE B 와 **글자 하나까지 같다**. 즉 오늘의 판정기에서
   * partial 품번 앞에서는 교차판매처 축이 «있으나 없으나 똑같다».
   */
  it("CASE C: partial + UNKNOWN → CASE B 와 완전히 같다(교차판매처 축이 무력하다)", () => {
    expect(LEVELS.map((l) => judge(l, "partial", "UNKNOWN"))).toEqual(
      LEVELS.map((l) => judge(l, "partial", "SIMILAR")),
    );
    expect(LEVELS.map((l) => judge(l, "partial", "UNKNOWN"))).toEqual(
      LEVELS.map((l) => judge(l, "partial", undefined)),
    );
  });

  /**
   * CASE D — modelCode=exact · crossSeller=CONFLICT
   *
   * 유일하게 교차판매처가 이기는 자리다(match-truth.ts:67). 반증은 품번보다 세다.
   * 이 줄이 살아 있는 한 「색이 다른데 EXACT」 같은 사고는 나지 않는다.
   */
  it("CASE D: exact + CONFLICT → 네 등급 전부 EXCLUDED(반증이 품번을 이긴다)", () => {
    expect(LEVELS.map((l) => judge(l, "exact", "CONFLICT"))).toEqual([
      { truth: "CONFLICT", tier: "EXCLUDED" },
      { truth: "CONFLICT", tier: "EXCLUDED" },
      { truth: "CONFLICT", tier: "EXCLUDED" },
      { truth: "CONFLICT", tier: "EXCLUDED" },
    ]);
  });
});

/* ═══════════════ ② 대조군 — 품번이 없으면 같은 교차판매처 판정이 다른 값을 낸다 ═══════════════ */

describe("P0-A ②: 같은 crossSeller 판정이 modelCode 유무로 갈린다", () => {
  /**
   * 🔴 **이 표가 이번 조사의 핵심 증거다.**
   *
   * 교차판매처 판정을 고정해 놓고 modelCode 만 바꾼다. 상품에 대해 «새로 알게 된
   * 사실이 하나도 없는데» 티어가 통째로 달라진다 — 품번을 비교할 수 있느냐 없느냐는
   * 「두 상품이 같은가」가 아니라 「이 판매처가 품번을 싣느냐」에 대한 사실이다.
   */
  it("PRESUMED_SAME: 품번 있으면 EXACT, 없으면 COMPARISON", () => {
    for (const level of LEVELS) {
      expect(judge(level, "exact", "PRESUMED_SAME").tier).toBe("EXACT");
      expect(judge(level, "partial", "PRESUMED_SAME").tier).toBe("EXACT");
      // 같은 판정, 같은 등급 — 품번 칸만 비었다.
      expect(judge(level, "unavailable", "PRESUMED_SAME")).toEqual({
        truth: "TEXT_CONFIRMED",
        tier: "COMPARISON",
      });
    }
  });

  it("UNKNOWN: 품번 있으면 EXACT, 없으면 low 에서 EXCLUDED 까지 내려간다", () => {
    expect(judge("low", "unavailable", "UNKNOWN")).toEqual({
      truth: "INSUFFICIENT_EVIDENCE",
      tier: "EXCLUDED",
    });
    expect(judge("medium", "unavailable", "UNKNOWN")).toEqual({ truth: "SIMILAR", tier: "COMPARISON" });
    expect(judge("high", "unavailable", "UNKNOWN")).toEqual({ truth: "TEXT_CONFIRMED", tier: "COMPARISON" });
    // 같은 UNKNOWN 인데 품번이 partial 이면 low 에서도 EXACT 다.
    expect(judge("low", "partial", "UNKNOWN").tier).toBe("EXACT");
  });

  /** SAME 은 품번이 없어도 EXACT 에 닿는 유일한 교차판매처 판정이다. */
  it("SAME 만이 품번 없이 EXACT 에 닿는다", () => {
    const verdicts: CrossSellerVerdict[] = ["SAME", "PRESUMED_SAME", "SIMILAR", "UNKNOWN", "CONFLICT"];
    const reachable = verdicts.filter((v) =>
      LEVELS.some((l) => judge(l, "unavailable", v).tier === "EXACT"),
    );
    expect(reachable).toEqual(["SAME"]);
  });
});

/* ═══════════════ ③ 전수표 — 4 level × 4 modelCode × 6 crossSeller ═══════════════ */

const MODEL_CODES: readonly ModelEvidenceResult[] = ["exact", "partial", "conflict", "unavailable"];
const CROSS: readonly (CrossSellerVerdict | undefined)[] = [
  undefined,
  "SAME",
  "PRESUMED_SAME",
  "SIMILAR",
  "UNKNOWN",
  "CONFLICT",
];

describe("P0-A ③: 96개 입력 전수 — 오늘의 티어 분포를 숫자로 고정한다", () => {
  /** 입력 전수를 돌려 티어별 개수를 센다. 숫자가 움직이면 무언가 바뀐 것이다. */
  it("전수 96칸의 티어 분포", () => {
    const count = { EXACT: 0, COMPARISON: 0, EXCLUDED: 0 };
    for (const level of LEVELS) {
      for (const modelCode of MODEL_CODES) {
        for (const crossSeller of CROSS) {
          count[judge(level, modelCode, crossSeller).tier] += 1;
        }
      }
    }
    expect(LEVELS.length * MODEL_CODES.length * CROSS.length).toBe(96);
    // EXACT 44 = 품번 있고 crossSeller≠CONFLICT 40 + (unavailable × SAME) 4
    //            → 🔴 EXACT 의 91%(40/44)가 «품번 한 축»에서 나온다.
    //
    // P0-A.29-F R1(2026-09-20) — COMPARISON 14 → 13, EXCLUDED 38 → 39.
    // 96칸 중 «정확히 한 칸» 이 움직였다: low / unavailable / SIMILAR.
    // 전수 대조로 확인했고 EXACT 는 44 에서 움직이지 않았다(아래 별도 검증).
    expect(count).toEqual({ EXACT: 44, COMPARISON: 13, EXCLUDED: 39 });
  });

  /**
   * 🔴 **가장 중요한 한 줄.** 품번이 exact/partial 이고 교차판매처가 CONFLICT 만
   *    아니면, 나머지 입력이 무엇이든 **예외 없이** 동일상품 가격에 들어간다.
   *    「보류」라는 뜻을 가진 판정(PRESUMED_SAME)도, 「아무것도 모른다」(UNKNOWN)도
   *    이 문을 막지 못한다.
   */
  it("🔴 품번이 있으면 CONFLICT 외에는 어떤 교차판매처 판정도 EXACT 를 막지 못한다", () => {
    const notBlocked: string[] = [];
    for (const level of LEVELS) {
      for (const modelCode of ["exact", "partial"] as const) {
        for (const crossSeller of CROSS) {
          if (crossSeller === "CONFLICT") continue;
          expect(judge(level, modelCode, crossSeller).tier).toBe("EXACT");
          notBlocked.push(`${level}/${modelCode}/${crossSeller ?? "none"}`);
        }
      }
    }
    // 4 level × 2 modelCode × 5 crossSeller(CONFLICT 제외) = 40
    expect(notBlocked).toHaveLength(40);
  });

  /** CONFLICT 는 어느 축에서 오든 항상 최하위다 — 이 성질에는 예외가 없다. */
  it("CONFLICT 는 어느 축에서 와도 항상 EXCLUDED 다", () => {
    for (const level of LEVELS) {
      for (const modelCode of MODEL_CODES) {
        expect(judge(level, modelCode, "CONFLICT").tier).toBe("EXCLUDED");
      }
      for (const crossSeller of CROSS) {
        expect(judge(level, "conflict", crossSeller).tier).toBe("EXCLUDED");
      }
    }
  });

  /** 랭크표는 6단계인데 가격은 3단계다 — 어디서 정보가 뭉개지는지 고정한다. */
  it("6단계 판정이 3단계 티어로 뭉개지는 지점", () => {
    const byTier: Record<string, MatchTruth[]> = { EXACT: [], COMPARISON: [], EXCLUDED: [] };
    for (const truth of Object.keys(MATCH_TRUTH_RANK) as MatchTruth[]) {
      byTier[priceTierFromLink({ matchTruth: truth, verified: false })].push(truth);
    }
    expect(byTier).toEqual({
      EXACT: ["EXACT_IDENTIFIER", "STRONG_IDENTIFIER"],
      COMPARISON: ["TEXT_CONFIRMED", "SIMILAR"],
      EXCLUDED: ["INSUFFICIENT_EVIDENCE", "CONFLICT"],
    });
  });
});

/**
 * P0-A.29-F R1(CEO 지시, 2026-09-20) — 이번에 «막은 한 칸» 을 못박는다.
 *
 * 실측(Lulu T Bar Shoes in Tobacco, 2026-09-20): 국내 원시 후보 18건이 전부
 * 「모델명 유사도 0%」인데 10건이 이 칸을 통해 SIMILAR 로 승격돼 화면에
 * 「비교 가능한 유사상품」으로 섰다 — 전부 다른 신발이었다.
 */
describe("P0-A.29-F R1: 교차판매처 SIMILAR 은 텍스트 등급을 «올리지» 않는다", () => {
  it("🔴 low + 식별자 없음 + SIMILAR → INSUFFICIENT_EVIDENCE (예전엔 SIMILAR)", () => {
    expect(deriveMatchTruth("low", "unavailable", "SIMILAR")).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("SAME 의 승격은 그대로다 — 텍스트가 바닥이어도 동일상품인 실제 사례가 이 길로 산다", () => {
    expect(deriveMatchTruth("low", "unavailable", "SAME")).toBe("STRONG_IDENTIFIER");
  });

  it("PRESUMED_SAME 의 승격도 그대로다", () => {
    expect(deriveMatchTruth("low", "unavailable", "PRESUMED_SAME")).toBe("TEXT_CONFIRMED");
  });

  it("🔴 품번 근거가 있으면 SIMILAR 이 와도 아무것도 깎지 못한다", () => {
    expect(deriveMatchTruth("low", "exact", "SIMILAR")).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("low", "partial", "SIMILAR")).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("very_high", "exact", "SIMILAR")).toBe("EXACT_IDENTIFIER");
  });

  it("텍스트가 스스로 SIMILAR/TEXT_CONFIRMED 인 등급은 내려가지 않는다 — 막은 것은 «승격» 뿐이다", () => {
    expect(deriveMatchTruth("medium", "unavailable", "SIMILAR")).toBe("SIMILAR");
    expect(deriveMatchTruth("high", "unavailable", "SIMILAR")).toBe("TEXT_CONFIRMED");
    expect(deriveMatchTruth("very_high", "unavailable", "SIMILAR")).toBe("TEXT_CONFIRMED");
  });
});
