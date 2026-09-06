import { describe, expect, it } from "vitest";
import { domesticMatchDisplay, overseasMatchDisplay } from "../match-display";

/**
 * MATCHING-UNIFY-1(CPO 지시, 2026-09-06) — 같은 의미의 판정이 국내/해외에서
 * 다른 문구로 보이던 문제를 고쳤다. 라벨이 다시 갈라지면 여기서 잡는다.
 *
 * 판정 알고리즘은 이 테스트의 대상이 아니다 — matchTruth 값이 무엇인지는
 * crawler가 정하고, 여기서는 그 값을 무엇이라 부를지만 검증한다.
 */
describe("matchDisplay — 국내/해외 매칭 표시 통일", () => {
  it("동일상품: 국내 EXACT/STRONG과 해외 EXACT/CONFIRMED가 같은 라벨이다", () => {
    const expected = { icon: "🟢", label: "동일상품" };
    for (const t of ["EXACT_IDENTIFIER", "STRONG_IDENTIFIER"] as const) {
      expect(domesticMatchDisplay(t)).toMatchObject(expected);
    }
    for (const t of ["EXACT_PRODUCT", "CONFIRMED_PRODUCT"] as const) {
      expect(overseasMatchDisplay(t)).toMatchObject(expected);
    }
  });

  it("동일상품 추정: 국내 TEXT_CONFIRMED와 해외 VERY_SIMILAR가 같은 라벨이다", () => {
    expect(domesticMatchDisplay("TEXT_CONFIRMED").label).toBe("동일상품 추정");
    expect(overseasMatchDisplay("VERY_SIMILAR").label).toBe("동일상품 추정");
    expect(domesticMatchDisplay("TEXT_CONFIRMED").note).toContain("식별자 미확인");
  });

  it("★ TEXT_CONFIRMED를 '옵션 다름'이라고 말하지 않는다", () => {
    // 국내 데이터에는 옵션 차이를 판별할 필드가 없다. 없는 사실을 만들지 않는다.
    const d = domesticMatchDisplay("TEXT_CONFIRMED");
    expect(`${d.label} ${d.note}`).not.toContain("옵션");
  });

  it("★ 옵션 차이는 실제 데이터가 있는 해외에서만 나온다", () => {
    expect(overseasMatchDisplay("SAME_MODEL_VARIANT").label).toBe("동일 모델 · 옵션 다름");
    // 국내 6개 값 어디에서도 이 등급이 나오지 않는다.
    for (const t of [
      "EXACT_IDENTIFIER",
      "STRONG_IDENTIFIER",
      "TEXT_CONFIRMED",
      "SIMILAR",
      "CONFLICT",
      "INSUFFICIENT_EVIDENCE",
    ] as const) {
      expect(domesticMatchDisplay(t).tier).not.toBe("SAME_MODEL_OPTION_DIFF");
    }
  });

  it("유사상품 / 판단 불가: 양쪽이 같은 라벨이다", () => {
    expect(domesticMatchDisplay("SIMILAR").label).toBe("유사상품");
    expect(overseasMatchDisplay("SIMILAR").label).toBe("유사상품");
    expect(domesticMatchDisplay("INSUFFICIENT_EVIDENCE").label).toBe("판단 불가");
    expect(overseasMatchDisplay("INSUFFICIENT_EVIDENCE").label).toBe("판단 불가");
  });

  it("★ CONFLICT를 유사상품으로 낮추지 않는다 — 명백한 부정 증거다", () => {
    for (const d of [domesticMatchDisplay("CONFLICT"), overseasMatchDisplay("CONFLICT")]) {
      expect(d.icon).toBe("🔴");
      expect(d.label).toBe("다른 상품 가능성");
      expect(d.tier).toBe("CONFLICT");
    }
  });
});
