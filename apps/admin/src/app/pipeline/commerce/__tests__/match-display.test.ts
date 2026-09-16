import { describe, expect, it } from "vitest";
import { domesticEvidenceNote, domesticMatchDisplay, overseasMatchDisplay } from "../match-display";

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

/**
 * MATCHING-FIX-01 Phase D(CEO 지시, 2026-09-16) — **배지가 사람의 확인을 사칭하지
 * 않는다.**
 *
 * 지시 원문 둘:
 *   · "verified=true 는 «사람의 확인이 아니다». 사람이 확인한 것처럼 보이면 안 된다."
 *   · "match-display.ts 가 EXACT_IDENTIFIER 와 STRONG_IDENTIFIER 를 «같은 🟢»으로
 *      그린다. confidence 38% 가 100% 와 같은 배지를 단다."
 *
 * 등급(tier)은 일부러 그대로 뒀다 — 등급이 곧 가격 정책이고(priceTierFromLink),
 * 여기서 등급을 가르면 판정이 바뀐다. 대신 «무슨 근거였는지»를 말하는 줄을 따로
 * 만든다. 아래 두 테스트가 그 둘을 각각 지킨다.
 */
describe("MATCHING-FIX-01 Phase D — 화면이 판정의 출처를 말한다", () => {
  const ALL_TRUTHS = [
    "EXACT_IDENTIFIER",
    "STRONG_IDENTIFIER",
    "TEXT_CONFIRMED",
    "SIMILAR",
    "CONFLICT",
    "INSUFFICIENT_EVIDENCE",
  ] as const;

  it("🔴 어떤 배지도 «사람이 확인했다»고 말하지 않는다", () => {
    for (const truth of ALL_TRUTHS) {
      const d = domesticMatchDisplay(truth);
      const text = `${d.label} ${d.note} ${domesticEvidenceNote(truth)}`;
      expect(text).not.toContain("사람");
      // 「확인됨」은 셀러에게 «누군가 봤다»로 읽힌다. 엔진이 판정했다고 말한다.
      expect(text).not.toContain("확인됨");
      expect(domesticEvidenceNote(truth)).toContain("엔진 자동 판정");
    }
  });

  it("🔴 EXACT_IDENTIFIER 와 STRONG_IDENTIFIER 는 같은 🟢 이지만 근거 문장이 다르다", () => {
    const exact = domesticMatchDisplay("EXACT_IDENTIFIER");
    const strong = domesticMatchDisplay("STRONG_IDENTIFIER");
    // 등급은 그대로다 — 가격 정책을 건드리지 않았다는 증거.
    expect(exact.tier).toBe(strong.tier);
    expect(exact.icon).toBe(strong.icon);
    // 근거는 갈린다.
    expect(domesticEvidenceNote("EXACT_IDENTIFIER")).not.toBe(domesticEvidenceNote("STRONG_IDENTIFIER"));
    expect(domesticEvidenceNote("EXACT_IDENTIFIER")).toContain("완전히 일치");
    expect(domesticEvidenceNote("STRONG_IDENTIFIER")).toContain("부분");
  });

  it("여섯 값 전부 자기 문장을 갖는다 — 빈 칸도 중복도 없다", () => {
    const notes = ALL_TRUTHS.map(domesticEvidenceNote);
    expect(notes.every((n) => n.length > 0)).toBe(true);
    expect(new Set(notes).size).toBe(ALL_TRUTHS.length);
  });
});
