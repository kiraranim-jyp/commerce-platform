import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifySellerProbability,
  CODE_FIELD_LABEL,
  resolveSellerDisplay,
  SELLER_DISPLAY_LABEL,
  SUPPORTING_DIFF_LABEL,
  type SellerProbabilityInput,
} from "../seller-probability";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-LIST-UI-01 — **CPO 4상태 표시 계층**(승인 2026-11-06 ②③)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **표시 계층이다 — 판정을 만들지 않는다.** Identity 임계값 · 8축 · 가격
 *    eligibility · GT · 해외 검색 **변경 0**. 이미 계산된 값을 «말» 로 바꾼다.
 *
 * 🔴 분류는 **운영 함수를 직접 불러** 만든다(`classifySellerProbability`) —
 *    손으로 만든 `SellerProbabilityResult` 를 넣으면 분류기를 **두 번 재구현** 한 것이 된다.
 */

/** 🟢 C19·C20 의 실제 모양 — 브랜드·품번 일치(식별자 확정) + **색상 충돌**. */
const CORE_MATCHED: SellerProbabilityInput = {
  crossSellerBlockers: [],
  crossSellerConflicts: [],
  matchTruth: "EXACT_IDENTIFIER",
  agreement: { agree: ["근거: 핵심 상품명 bubble/sweatshirt"], hold: [] },
};

const r = (over: Partial<SellerProbabilityInput> = {}) =>
  classifySellerProbability({ ...CORE_MATCHED, ...over });

describe("CANDIDATE-LIST-UI-01 A — CPO 네 상태", () => {
  it("A-1 🟢 핵심 일치 + 차이 없음 + 이미지 있음 → 동일상품 가능성 높음", () => {
    const d = resolveSellerDisplay({ result: r(), imageEvidence: "BOTH" });
    expect(d.state).toBe("LIKELY_SAME");
    expect(d.label).toBe("동일상품 가능성 높음");
  });

  /** 🔴🔴 **CPO ③ 의 핵심** — C19·C20 이 여기로 와야 한다(전엔 HIGH 로만 보였다). */
  it("A-2 🟢🟢 핵심 일치 + **색상 차이** → 유사상품(C19·C20)", () => {
    const d = resolveSellerDisplay({ result: r(), conflicts: ["COLOR"], imageEvidence: "BOTH" });
    expect(d.state).toBe("LIKELY_SIMILAR");
    expect(d.label).toBe("유사상품");
    expect(d.differingAxes).toEqual(["색상"]);
    expect(d.reason).toContain("핵심 식별정보는 같고");
    expect(d.reason).toContain("색상");
  });

  /** 🔴🔴 **CPO ② 의 핵심** — C22 는 SAME 도 SIMILAR 도 **확정하지 않는다**. */
  it("A-3 🔴 핵심 일치인데 **후보 이미지 0** → 검토 필요(C22)", () => {
    const d = resolveSellerDisplay({ result: r(), imageEvidence: "NONE" });
    expect(d.state).toBe("NEEDS_REVIEW");
    expect(d.label).toBe("검토 필요");
    expect(d.reason).toContain("이미지가 없습니다");
  });

  it("A-4 🔴 강한 불일치(브랜드/품번) → 다른 상품일 수 있음", () => {
    const d = resolveSellerDisplay({
      result: r({ crossSellerBlockers: ["BRAND_MISMATCH"] }),
      imageEvidence: "BOTH",
    });
    expect(d.state).toBe("LIKELY_DIFFERENT");
    expect(d.label).toBe("다른 상품일 수 있음");
  });

  it("A-5 🔴 근거 부족은 **검토 필요** 다 — 「동일」로 새지 않는다", () => {
    const d = resolveSellerDisplay({
      result: r({ matchTruth: null, agreement: { agree: [], hold: [] }, crossSellerBlockers: ["BRAND_UNCONFIRMED"] }),
    });
    expect(d.state).toBe("NEEDS_REVIEW");
  });

  it("A-6 🟢 라벨 넷이 CPO 어휘와 **글자 그대로** 같다", () => {
    expect(Object.values(SELLER_DISPLAY_LABEL).sort()).toEqual(
      ["검토 필요", "다른 상품일 수 있음", "동일상품 가능성 높음", "유사상품"].sort(),
    );
  });
});

describe("CANDIDATE-LIST-UI-01 B — 순서가 계약이다", () => {
  /** 🔴 차이가 **이미 확인됐으면** 이미지가 없어도 유사상품으로 말할 수 있다. */
  it("B-1 🟢 보조 차이가 이미지 부족을 **이긴다**(② > ③)", () => {
    const d = resolveSellerDisplay({ result: r(), conflicts: ["COLOR"], imageEvidence: "NONE" });
    expect(d.state).toBe("LIKELY_SIMILAR");
  });

  /** 🔴🔴 이미지가 없으면 「차이가 없다」를 **확인한 것이 아니다** — C22 가 그 증거다. */
  it("B-2 🔴 이미지 부족이 「동일」을 **막는다**(③ > ④)", () => {
    const withImg = resolveSellerDisplay({ result: r(), imageEvidence: "BOTH" });
    const noImg = resolveSellerDisplay({ result: r(), imageEvidence: "NONE" });
    expect(withImg.state).toBe("LIKELY_SAME");
    expect(noImg.state).toBe("NEEDS_REVIEW");
  });

  /** 🔴 강한 불일치는 **무엇보다 먼저** 다. */
  it("B-3 🔴 강한 불일치가 보조 차이보다 **먼저** 다(① > ②)", () => {
    const d = resolveSellerDisplay({
      result: r({ crossSellerConflicts: ["MODEL_CODE"] }),
      conflicts: ["COLOR", "MODEL_CODE"],
      imageEvidence: "BOTH",
    });
    expect(d.state).toBe("LIKELY_DIFFERENT");
  });

  /** 🔴 `UNKNOWN`(안 넘김)을 「이미지 없음」으로 읽지 않는다. */
  it("B-4 🔴 이미지 축을 **안 넘기면** 그것을 「없음」으로 취급하지 않는다", () => {
    expect(resolveSellerDisplay({ result: r() }).state).toBe("LIKELY_SAME");
    expect(resolveSellerDisplay({ result: r(), imageEvidence: "UNKNOWN" }).state).toBe("LIKELY_SAME");
  });
});

describe("CANDIDATE-LIST-UI-01 C — 「다른 표기」를 「다른 상품」으로 만들지 않는다", () => {
  /**
   * 🔴🔴 `COLOR_VARIANT` 는 **보류** 다(색조는 같고 색상명만 다름 · WU-044 계약).
   *    차이로 세면 「Light blue ↔ 라이트블루」가 유사상품으로 강등된다.
   */
  it("C-1 🔴 `COLOR_VARIANT` 는 보조 «차이» 가 아니다", () => {
    expect(SUPPORTING_DIFF_LABEL).not.toHaveProperty("COLOR_VARIANT");
    const d = resolveSellerDisplay({ result: r(), conflicts: ["COLOR_VARIANT"], imageEvidence: "BOTH" });
    expect(d.state).toBe("LIKELY_SAME");
    expect(d.differingAxes).toEqual([]);
  });

  it("C-2 🟢 모르는 토큰은 **조용히 무시** 한다(지어낸 라벨이 화면에 서지 않는다)", () => {
    const d = resolveSellerDisplay({ result: r(), conflicts: ["WHATEVER_NEW_TOKEN"], imageEvidence: "BOTH" });
    expect(d.differingAxes).toEqual([]);
    expect(d.state).toBe("LIKELY_SAME");
  });
});

describe("CANDIDATE-LIST-UI-01 D — 품번 «세 칸» 을 섞지 않는다", () => {
  /** 🔴 이 구분이 없어서 이번 트랙에서 거짓 블로커가 CPO 까지 올라갔다. */
  it("D-1 🟢 세 칸의 말이 서로 **다르다**", () => {
    const vals = Object.values(CODE_FIELD_LABEL);
    expect(new Set(vals).size).toBe(3);
    expect(CODE_FIELD_LABEL.ORIGIN_EXTRACTED).toBe("원상품 품번");
    expect(CODE_FIELD_LABEL.CANDIDATE_CONFIRMED).toContain("일치 확인");
    expect(CODE_FIELD_LABEL.SELLER_OWN).toContain("미확인");
  });

  it("D-2 🔴 판매처 코드를 「품번」이라고 부르지 않는다", () => {
    expect(CODE_FIELD_LABEL.SELLER_OWN).toContain("판매처");
    expect(CODE_FIELD_LABEL.SELLER_OWN).not.toMatch(/^원상품/);
  });
});

describe("CANDIDATE-LIST-UI-01 E — 경계 보존", () => {
  const SRC = readFileSync(join(__dirname, "..", "seller-probability.ts"), "utf8");
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

  /** 🔴 이 파일은 **판정기가 아니다** — 가격·알림·등록 어휘가 들어오면 FAIL 한다. */
  it("E-1 🔴 가격·알림·등록 어휘가 없다", () => {
    for (const banned of ["priceKrw", "priceTier", "computeMarketAlert", "price_alerts", "payload"]) {
      expect(code, `🔴 표시 계층에 ${banned} 가 들어왔다`).not.toContain(banned);
    }
  });

  /** 🔴 내부 상태 이름에 Identity 어휘를 쓰지 않는다(이 파일 :46 이 적어 둔 이유). */
  it("E-2 🔴 상태 토큰이 `SAME`/`DIFFERENT` **단독** 어휘가 아니다", () => {
    expect(code).toContain("LIKELY_SAME");
    expect(code).toContain("LIKELY_DIFFERENT");
    expect(code, "🔴 Identity 어휘를 그대로 쓰면 「판정이 여기서 일어난다」로 읽힌다")
      .not.toMatch(/"PRESUMED_SAME"/);
  });

  /** 🟢 기존 4등급(`probability`)을 **바꾸지 않았다** — 분석 스크립트 5종이 그것을 쓴다. */
  it("E-3 🟢 기존 `probability` 어휘 넷이 그대로다", () => {
    expect(code).toContain('HIGH: "동일상품 가능성 높음"');
    expect(code).toContain('CONFLICTED: "다른 상품일 수 있음"');
    expect(r().probability).toBe("HIGH");
  });
});
