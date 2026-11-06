/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 §3 계약 — **고확률 분류는 CPO 규칙 여덟을 그대로 지킨다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 **순수 함수** 만 본다 — 네트워크 0 · DB 0 · 렌더 0.
 * 🔴 Identity 판정을 부르지 않는다(`compareCrossSellerProducts` 등 **0회**).
 */
import { describe, expect, it } from "vitest";
import {
  classifySellerProbability,
  sellerProbabilitySummary,
  SELLER_PROBABILITY_LABEL,
} from "../seller-probability";
import { splitEvidenceReasons } from "../blocker-text";

/** 🟢 실측 문구를 쓴다 — IPES DOSSIER 13행에서 그대로 가져온 모양이다. */
const AGREE_GENERIC = splitEvidenceReasons([
  "근거: 상품군 TOP↔TOP",
  "근거: 색상 BLUE",
  "근거: 대상 KIDS",
  "보류: 브랜드 Bobo Choses ↔ STONE ISLAND JUNIOR",
  "보류: 핵심 상품명에 겹치는 말이 없다",
]);
const AGREE_WITH_NAME = splitEvidenceReasons(["근거: 핵심 상품명 hug/monster", "근거: 색상 BLUE"]);

describe("MLS2 §3 — 고확률 분류", () => {
  it("🟢 핵심 근거 2개(브랜드 + 품번)가 일치하면 **고확률** 이다", () => {
    const r = classifySellerProbability({
      crossSellerBlockers: [],
      matchTruth: "EXACT_IDENTIFIER",
      agreement: AGREE_GENERIC,
    });
    expect(r.matchedCount).toBe(2);
    expect(r.probability).toBe("HIGH");
    expect(SELLER_PROBABILITY_LABEL[r.probability]).toBe("동일상품 가능성 높음");
  });

  it("🟢 브랜드 + 상품명 조합도 고확률이다(품번이 미확인이어도)", () => {
    const r = classifySellerProbability({ crossSellerBlockers: [], matchTruth: null, agreement: AGREE_WITH_NAME });
    expect(r.findings.map((f) => f.state)).toEqual(["MATCHED", "MATCHED", "UNKNOWN"]);
    expect(r.probability).toBe("HIGH");
  });

  /**
   * 🔴🔴 **CPO 규칙의 핵심** — 「강한 불일치가 발견되면 단순 일치 개수만으로
   *    고확률 분류하지 않는다」. 그래서 불일치 검사가 **개수 검사보다 먼저** 온다.
   */
  it("🔴🔴 일치가 2개여도 **확인된 불일치가 하나라도** 있으면 고확률이 아니다", () => {
    const r = classifySellerProbability({
      crossSellerBlockers: ["NO_TITLE_OVERLAP"],
      matchTruth: "EXACT_IDENTIFIER",
      agreement: AGREE_GENERIC,
    });
    expect(r.mismatchedCount).toBe(1);
    expect(r.probability).toBe("CONFLICTED");
    expect(SELLER_PROBABILITY_LABEL[r.probability]).toBe("다른 상품일 수 있음");
  });

  it("🔴 「미확인」을 「일치」로 세지 않는다 — 전부 미확인이면 근거 부족이다", () => {
    const r = classifySellerProbability({
      crossSellerBlockers: ["BRAND_UNCONFIRMED"],
      matchTruth: null,
      agreement: splitEvidenceReasons([]),
    });
    expect(r.matchedCount).toBe(0);
    expect(r.unknownCount).toBe(3);
    expect(r.probability).toBe("INSUFFICIENT");
  });

  it("🔴 `BRAND_MISMATCH`(불일치)와 `BRAND_UNCONFIRMED`(미확인)를 가른다", () => {
    const mismatch = classifySellerProbability({ crossSellerBlockers: ["BRAND_MISMATCH"], agreement: AGREE_WITH_NAME });
    const unknown = classifySellerProbability({ crossSellerBlockers: ["BRAND_UNCONFIRMED"], agreement: AGREE_WITH_NAME });
    expect(mismatch.findings[0].state).toBe("MISMATCHED");
    expect(unknown.findings[0].state).toBe("UNKNOWN");
    /** 🔴 둘이 **다른 분류** 로 떨어진다 — 섞이면 이 단언이 깨진다. */
    expect(mismatch.probability).toBe("CONFLICTED");
    expect(unknown.probability).toBe("POSSIBLE");
  });

  it("🔴 품번은 「값이 있다」가 아니라 「확인됐다」만 일치다", () => {
    for (const truth of ["TEXT_CONFIRMED", "SIMILAR", null, "CONFLICT"]) {
      const r = classifySellerProbability({ crossSellerBlockers: [], matchTruth: truth, agreement: AGREE_GENERIC });
      expect(r.findings[2].state).toBe("UNKNOWN");
    }
    for (const truth of ["EXACT_IDENTIFIER", "STRONG_IDENTIFIER"]) {
      const r = classifySellerProbability({ crossSellerBlockers: [], matchTruth: truth, agreement: AGREE_GENERIC });
      expect(r.findings[2].state).toBe("MATCHED");
    }
  });

  it("🔴 품번 충돌은 **확인된 불일치** 다", () => {
    const r = classifySellerProbability({
      crossSellerBlockers: [],
      crossSellerConflicts: ["MODEL_CODE"],
      matchTruth: "EXACT_IDENTIFIER",
      agreement: AGREE_WITH_NAME,
    });
    expect(r.findings[2].state).toBe("MISMATCHED");
    expect(r.probability).toBe("CONFLICTED");
  });

  /** 🔴 CPO 금지 ① — 「같은 원문을 여러 경로에서 추출했다고 중복 계산하지 않는다」. */
  it("🔴 핵심 축은 **축당 한 번만** 센다 — 같은 근거가 여러 줄이어도 2를 넘지 않는다", () => {
    const r = classifySellerProbability({
      crossSellerBlockers: [],
      matchTruth: "EXACT_IDENTIFIER",
      agreement: splitEvidenceReasons([
        "근거: 핵심 상품명 hug",
        "근거: 핵심 상품명 monster",
        "근거: 상품명 토큰 겹침",
      ]),
    });
    expect(r.matchedCount).toBeLessThanOrEqual(3);
    expect(r.findings.filter((f) => f.axis === "PRODUCT_NAME")).toHaveLength(1);
  });

  /** 🔴 CPO — 「추가 근거는 핵심 식별 근거의 강한 불일치를 덮는 용도로 사용하지 않는다」. */
  it("🔴🔴 가산 근거가 아무리 많아도 **고확률로 올리지 못한다**", () => {
    const many = splitEvidenceReasons([
      "근거: 상품군 TOP↔TOP",
      "근거: 색상 BLUE",
      "근거: 대상 KIDS",
      "근거: 소재 cotton",
      "근거: 옷의 형태 SHIRT",
    ]);
    const r = classifySellerProbability({ crossSellerBlockers: ["BRAND_MISMATCH"], matchTruth: null, agreement: many });
    expect(r.supporting.length).toBeGreaterThanOrEqual(5);
    expect(r.probability).toBe("CONFLICTED");
  });

  /** 🔴 CPO — 「충돌하는 근거는 숨기지 않고 별도로 표시한다」. */
  it("🟢 불일치 근거를 **버리지 않고** 따로 내보낸다", () => {
    const r = classifySellerProbability({ crossSellerBlockers: ["BRAND_MISMATCH"], agreement: AGREE_GENERIC });
    expect(r.conflicting).toContain("브랜드 Bobo Choses ↔ STONE ISLAND JUNIOR");
    expect(r.conflicting).toContain("핵심 상품명에 겹치는 말이 없다");
  });

  /**
   * 🔴🔴 **Identity 어휘를 쓰지 않는다** — 이 모듈이 `SAME`/`PRESUMED_SAME` 을
   *    내보내면 다음 사람이 「여기서 판정이 일어난다」고 읽는다
   *    (메모 `guard-blocking-my-name-means-the-name-collides`).
   */
  it("🔴 분류값과 라벨에 Identity 판정 어휘가 **없다**", () => {
    const values = Object.keys(SELLER_PROBABILITY_LABEL);
    expect(values).toEqual(["HIGH", "POSSIBLE", "CONFLICTED", "INSUFFICIENT"]);
    for (const v of values) expect(v).not.toMatch(/^(SAME|PRESUMED_SAME|SIMILAR|EXCLUDED)$/);
    /** 🔴 셀러가 읽는 말에 **내부 토큰이 없다**. */
    for (const label of Object.values(SELLER_PROBABILITY_LABEL)) {
      expect(label).not.toMatch(/SAME|BRAND_|MODEL_CODE|NO_TITLE|PRESUMED|blocker/i);
    }
    /** 🔴 「동일상품」을 **단정하지 않는다** — 전부 「가능성」/「수 있음」/「부족」이다. */
    expect(SELLER_PROBABILITY_LABEL.HIGH).toContain("가능성");
    expect(SELLER_PROBABILITY_LABEL.HIGH).not.toBe("동일상품");
  });

  it("🟢 요약 한 줄에 **점수가 없다** — 일치 개수와 상태만 말한다", () => {
    const r = classifySellerProbability({ crossSellerBlockers: [], matchTruth: "EXACT_IDENTIFIER", agreement: AGREE_GENERIC });
    const s = sellerProbabilitySummary(r);
    expect(s).toContain("핵심 근거 2/3 일치");
    expect(s).not.toMatch(/점수|score|\d+(\.\d+)?%|confidence/i);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════
   * 🔴🔴 **CEO GT 대조에서 나온 사실을 계약으로 고정한다**(2026-11-06 실측)
   * ══════════════════════════════════════════════════════════════════════
   * ```
   * 운영 DB 사람 판정 38행 · 고확률 **1** = 사람 SAME 1 · 사람 DIFFERENT **0**
   * 🟢 PRESUMED_SAME → CONFLICTED **13**  ⟸ IPES DOSSIER 의 그 13행이다
   * 🔴 사람 SAME 22 중 고확률 1 — 그런데 **놓침 21 의 축이 전부 같다**:
   *    BRAND:MATCHED · PRODUCT_NAME:**UNKNOWN** · DETAIL_IDENTIFIER:**UNKNOWN**
   * 🔴🔴 그 UNKNOWN 은 분류가 엄격해서가 아니라 **그 행에 Evidence 가 없어서** 다 —
   *    DOSSIER §5 실측: `match_truth` **22/38 미수집** · `candidate_title` 21/38 미수집
   * ⟹ 🔴 **이 분모로 recall 을 평가하지 않는다**(「측정불가 ≠ 0」 · 헌장 §5-B)
   * ```
   */
  it("🔴 Evidence 가 결손된 행은 **고확률이 될 수 없다**(그것이 올바른 상태다)", () => {
    /** 🟢 운영 결손 행의 실제 모양 — blockers 비어 있고 matchTruth 가 null 이다. */
    const r = classifySellerProbability({ crossSellerBlockers: [], matchTruth: null, agreement: splitEvidenceReasons([]) });
    expect(r.probability).not.toBe("HIGH");
    expect(r.unknownCount).toBeGreaterThanOrEqual(2);
    /** 🔴 「근거 부족」을 「다른 상품」으로 적지 않는다 — 셀러에게 다른 말이다. */
    expect(r.probability).not.toBe("CONFLICTED");
  });
});
