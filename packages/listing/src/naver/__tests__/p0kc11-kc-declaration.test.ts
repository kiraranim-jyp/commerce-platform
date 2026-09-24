import { describe, expect, it } from "vitest";
import {
  KIDS_CERTIFICATION_NOT_APPLICABLE,
  resolveKidsCertificationTypeNotice,
  buildCertificationTargetExcludeContent,
  requiresChildCertificationData,
  validateKcDeclaration,
  type SmartStoreKcDeclaration,
} from "../kc-declaration";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-11(CPO 확정, 2026-09-24) — **인증 대상 «신고» 축의 조합 규칙**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 파일이 지키는 것은 하나다: **판매자가 고른 것만 네이버로 간다.**
 * 따져는 어떤 상품이 KC 대상인지 판정하지 않고, 두 축을 자동 결합하지 않으며,
 * 반쪽짜리 신고를 대신 완성해 주지 않는다.
 */

const KIDS = { childCertificationRequired: true };
const GENERAL = { childCertificationRequired: false };
const d = (over: SmartStoreKcDeclaration): SmartStoreKcDeclaration => over;

describe("① CPO Test Matrix A~G", () => {
  it("A. child=대상아님 · kc=대상아님 → payload 생성 (면제 사유 없음)", () => {
    const out = buildCertificationTargetExcludeContent(d({ child: "EXCLUDED", kc: "EXCLUDED" }), KIDS);
    expect(out).toEqual({ childCertifiedProductExclusionYn: true, kcCertifiedProductExclusionYn: "TRUE" });
    expect(out).not.toHaveProperty("kcExemptionType");
  });

  it("B. child=대상 · kc=대상 → 인증정보 경로", () => {
    const decl = d({ child: "TARGET", kc: "TARGET" });
    expect(buildCertificationTargetExcludeContent(decl, KIDS)).toEqual({
      childCertifiedProductExclusionYn: false,
      kcCertifiedProductExclusionYn: "FALSE",
    });
    expect(requiresChildCertificationData(decl, KIDS)).toBe(true);
  });

  it.each([
    ["C", "OVERSEAS"],
    ["D", "SAFE_CRITERION"],
    ["E", "PARALLEL_IMPORT"],
  ] as const)("%s. child=대상아님 · kc=면제 · %s → 면제 payload", (_case, reason) => {
    expect(
      buildCertificationTargetExcludeContent(d({ child: "EXCLUDED", kc: "EXEMPTION", exemptionReason: reason }), KIDS),
    ).toEqual({
      childCertifiedProductExclusionYn: true,
      kcCertifiedProductExclusionYn: "KC_EXEMPTION_OBJECT",
      kcExemptionType: reason,
    });
  });

  it("🔴 F. kc=대상아님 인데 면제 사유가 붙어 있다 → 차단", () => {
    /* 「대상 아님」과 「면제」는 다른 주장이다. 겹치면 어느 쪽으로 신고한
       것인지 알 수 없으므로 payload 를 만들지 않는다. */
    const decl = d({ child: "EXCLUDED", kc: "EXCLUDED", exemptionReason: "OVERSEAS" });
    expect(validateKcDeclaration(decl, KIDS)).toContain("KC_EXEMPTION_REASON_NOT_ALLOWED");
    expect(buildCertificationTargetExcludeContent(decl, KIDS)).toBeUndefined();
  });

  it("🔴 G. kc=면제 인데 사유가 없다 → 차단 (반쪽 신고)", () => {
    const decl = d({ child: "EXCLUDED", kc: "EXEMPTION" });
    expect(validateKcDeclaration(decl, KIDS)).toContain("KC_EXEMPTION_REASON_MISSING");
    expect(buildCertificationTargetExcludeContent(decl, KIDS)).toBeUndefined();
  });
});

describe("② 🔴 두 축을 «자동 결합하지» 않는다", () => {
  it("어린이제품 대상 아님이 KC 대상 아님을 뜻하지 않는다", () => {
    const out = buildCertificationTargetExcludeContent(d({ child: "EXCLUDED" }), KIDS);
    expect(out).toEqual({ childCertifiedProductExclusionYn: true });
    expect(out).not.toHaveProperty("kcCertifiedProductExclusionYn");
  });

  it("KC 축만 골라도 어린이제품 축을 대신 정하지 않는다", () => {
    const out = buildCertificationTargetExcludeContent(d({ kc: "EXCLUDED" }), GENERAL);
    expect(out).toEqual({ kcCertifiedProductExclusionYn: "TRUE" });
    expect(out).not.toHaveProperty("childCertifiedProductExclusionYn");
  });

  it("🔴 해외구매대행이라고 OVERSEAS 를 자동으로 넣지 않는다", () => {
    /* 따져는 100% 해외구매대행이지만, 그것이 이 «상품» 의 면제 사유인지는
       판매자만 안다. 고르지 않았으면 키 자체가 없다. */
    const out = buildCertificationTargetExcludeContent(d({ child: "TARGET", kc: "TARGET" }), KIDS);
    expect(out).not.toHaveProperty("kcExemptionType");
  });
});

describe("③ 🔴 고르지 않은 것을 대신 고르지 않는다", () => {
  it("선언이 아예 없으면 payload 도 없다", () => {
    expect(buildCertificationTargetExcludeContent(undefined, KIDS)).toBeUndefined();
    expect(buildCertificationTargetExcludeContent({}, KIDS)).toBeUndefined();
  });

  it("어린이제품 카테고리인데 축을 안 골랐으면 «문제로 말한다» — 대신 정하지 않는다", () => {
    expect(validateKcDeclaration({}, KIDS)).toContain("CHILD_CHOICE_MISSING");
    expect(validateKcDeclaration({ child: "TARGET" }, KIDS)).not.toContain("CHILD_CHOICE_MISSING");
  });

  it("어린이제품 카테고리가 아니면 그 축을 요구하지 않는다", () => {
    expect(validateKcDeclaration({}, GENERAL)).toEqual([]);
  });
});

describe("④ 인증정보를 언제 요구하는가 — 카테고리 + 선언", () => {
  it("🔴 선언이 없으면 예전 그대로 요구한다 — 없는 것을 「대상 아님」으로 읽지 않는다", () => {
    expect(requiresChildCertificationData(undefined, KIDS)).toBe(true);
    expect(requiresChildCertificationData({}, KIDS)).toBe(true);
  });

  it("「대상 아님」을 «골랐을 때만» 요구를 푼다", () => {
    expect(requiresChildCertificationData({ child: "EXCLUDED" }, KIDS)).toBe(false);
    expect(requiresChildCertificationData({ child: "TARGET" }, KIDS)).toBe(true);
  });

  it("🔴 면제는 어린이제품 «인증정보» 요구를 풀지 않는다 — 다른 축이다", () => {
    expect(
      requiresChildCertificationData({ child: "TARGET", kc: "EXEMPTION", exemptionReason: "OVERSEAS" }, KIDS),
    ).toBe(true);
  });

  it("어린이제품 카테고리가 아니면 애초에 요구하지 않는다", () => {
    expect(requiresChildCertificationData(undefined, GENERAL)).toBe(false);
  });
});

describe("⑤ 네이버 enum 을 그대로 쓴다 — 우리 어휘를 만들지 않는다", () => {
  it("TRUE / FALSE / KC_EXEMPTION_OBJECT", () => {
    const kc = (c: "TARGET" | "EXCLUDED") =>
      buildCertificationTargetExcludeContent({ kc: c }, GENERAL)?.kcCertifiedProductExclusionYn;
    expect(kc("EXCLUDED")).toBe("TRUE");
    expect(kc("TARGET")).toBe("FALSE");
    expect(
      buildCertificationTargetExcludeContent({ kc: "EXEMPTION", exemptionReason: "OVERSEAS" }, GENERAL)
        ?.kcCertifiedProductExclusionYn,
    ).toBe("KC_EXEMPTION_OBJECT");
  });

  it("childCertifiedProductExclusionYn 은 boolean 이다(공식 스키마)", () => {
    expect(
      buildCertificationTargetExcludeContent({ child: "EXCLUDED" }, KIDS)?.childCertifiedProductExclusionYn,
    ).toBe(true);
    expect(
      buildCertificationTargetExcludeContent({ child: "TARGET" }, KIDS)?.childCertifiedProductExclusionYn,
    ).toBe(false);
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-12(CPO 확정 ㉠, 2026-09-24) — **KIDS 고시의 「KC 인증정보」**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 400 이 확정한 것: 규제 «신고» 와 소비자 «고시» 는 다른 축이고, 고시는
 * KIDS 카테고리면 «항상» 값을 요구한다.
 *
 * 🔴 따져가 「대상이 아니다」라고 판단하는 것이 아니다. 판매자가 ⑧에서 고른
 * 선언을 고시 문자열로 옮겨 적을 뿐이다.
 */
describe("⑥ 고시값 — Child 축 «하나만» 기준이다", () => {
  const T = (d: SmartStoreKcDeclaration | undefined, entered?: string) =>
    resolveKidsCertificationTypeNotice(d, entered);

  it("CPO 매트릭스 1 — 미선택 · 미선택 → 기존 입력 요구(값 없음)", () => {
    expect(T(undefined)).toBeUndefined();
    expect(T({})).toBeUndefined();
  });

  it("CPO 매트릭스 2 — 대상 · 대상 → 기존 입력 요구", () => {
    expect(T({ child: "TARGET", kc: "TARGET" })).toBeUndefined();
  });

  it("🔴 CPO 매트릭스 3 — 대상 아님 · KC 대상 → 「해당사항 없음」", () => {
    expect(T({ child: "EXCLUDED", kc: "TARGET" })).toBe(KIDS_CERTIFICATION_NOT_APPLICABLE);
  });

  it("🔴 CPO 매트릭스 4 — 대상 아님 · KC 대상 아님 → 「해당사항 없음」", () => {
    expect(T({ child: "EXCLUDED", kc: "EXCLUDED" })).toBe(KIDS_CERTIFICATION_NOT_APPLICABLE);
  });

  it("🔴 CPO 매트릭스 5 — 대상 아님 · KC 면제/OVERSEAS → 「해당사항 없음」", () => {
    expect(T({ child: "EXCLUDED", kc: "EXEMPTION", exemptionReason: "OVERSEAS" })).toBe(
      KIDS_CERTIFICATION_NOT_APPLICABLE,
    );
  });

  it("🔴 KC 축«만» 으로는 만들지 않는다 — 금지선", () => {
    /* 「KC 대상 아님」이 「어린이제품 대상 아님」을 뜻하지 않는다. */
    expect(T({ kc: "EXCLUDED" })).toBeUndefined();
    expect(T({ kc: "EXEMPTION", exemptionReason: "OVERSEAS" })).toBeUndefined();
    expect(T({ kc: "EXEMPTION", exemptionReason: "SAFE_CRITERION" })).toBeUndefined();
    expect(T({ kc: "EXEMPTION", exemptionReason: "PARALLEL_IMPORT" })).toBeUndefined();
  });

  it("🔴 판매자가 적은 실제 값이 언제나 우선이다 — 선언이 입력을 덮지 않는다", () => {
    expect(T({ child: "EXCLUDED" }, "공급자적합성확인대상 어린이제품")).toBe(
      "공급자적합성확인대상 어린이제품",
    );
    expect(T({ child: "TARGET" }, "안전확인대상 어린이제품")).toBe("안전확인대상 어린이제품");
  });

  it("문자열은 판매자센터가 쓰는 표현 그대로다", () => {
    expect(KIDS_CERTIFICATION_NOT_APPLICABLE).toBe("해당사항 없음");
  });

  it("🔴 고시와 신고는 서로를 만들지 않는다", () => {
    /* 고시값이 생겼다고 certificationTargetExcludeContent 가 달라지지 않는다. */
    const d: SmartStoreKcDeclaration = { child: "EXCLUDED", kc: "TARGET" };
    expect(buildCertificationTargetExcludeContent(d, KIDS)).toEqual({
      childCertifiedProductExclusionYn: true,
      kcCertifiedProductExclusionYn: "FALSE",
    });
    expect(T(d)).toBe(KIDS_CERTIFICATION_NOT_APPLICABLE);
  });
});
