import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "../cross-seller";
import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IDENTITY-AGE-LINE-AUDIT-01 §13 — **M1~M4 계약**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 전략: 「**baby 와 kids 는 처음부터 같은 후보군에서 본다.** 연령/라인 표현의
 *           차이는 후보를 버리는 이유가 아니라 Evidence 중 하나다.」
 *
 * 🔴🔴 이 파일은 **현재 운영 동작을 고정** 한다(코드 변경 0). 정책이 열리면 해당
 *    단언이 **FAIL 로 뒤집히고 그것이 수정의 증거** 다(쿠팡 고시 선례).
 * 🔴 `AB ↔ AC → SAME` 강제 0 · `→ DIFFERENT` 강제 0 · threshold 0 · blocker 삭제 0.
 *
 * 🟢 입력은 **실측값** 이다(AGE-LINE-01 감사 · 새 Search 0):
 *    원상품  `B226AC009` · T-shirts · Light blue · Organic Cotton 100% · loose fit
 *    후보    `B226AB040`(bobochoses 공식몰 baby 라인) — 위 네 축이 **글자 그대로 같다**
 */

function facts(over: Partial<ProductFacts>): ProductFacts {
  return {
    sourceUrl: "https://shop.example.com/products/x",
    urlSlug: null,
    brand: "Bobo Choses",
    brandModelCode: null,
    sellerSku: null,
    title: "Hug Hairy Monster T-shirt",
    coreTitleTokens: ["hug", "hairy", "monster", "shirt"],
    categoryText: "T-shirts",
    colorText: "light blue",
    materialText: "Organic Cotton 100%",
    fitText: "loose fit",
    ageRangeText: null,
    sizeLabels: [],
    audienceSignals: ["children"],
    imageUrls: [],
    ...over,
  } as unknown as ProductFacts;
}

const ORIGIN = facts({ brandModelCode: "B226AC009", sizeLabels: ["4Y", "6Y"] });

describe("AGE-LINE-01 M1 — 연령 표현 «차이만» 으로 DIFFERENT 가 되지 않는다", () => {
  /**
   * 🟢🟢 실측 확인(cissywears · kolkid · billsstore · cissywears) — 품번이 없고
   *    연령 라인만 다른 네 후보는 **`PRESUMED_SAME`** 이었다. `DIFFERENT` 가 아니다.
   * 🔴 그래서 「baby 라면 버린다」는 **현재 코드에 없다** — 이 계약이 그 사실을 잠근다.
   */
  it("M1-a 🟢 baby 라인 + 나머지 강일치 → **보류(PRESUMED_SAME)** 이고 DIFFERENT 가 아니다", () => {
    const baby = facts({
      title: "Bobo Choses Baby Hug Hairy Monster T-Shirt",
      coreTitleTokens: ["baby", "hug", "hairy", "monster", "shirt"],
      sizeLabels: ["6M", "12M"],
      audienceSignals: ["baby"],
    });
    const m = compareCrossSellerProducts(ORIGIN, baby);
    expect(m.verdict, `실측과 다르다: ${JSON.stringify(m.reasons)}`).toBe("PRESUMED_SAME");
    expect(m.verdict).not.toBe("CONFLICT");
    /** 🔴 보류의 «이유» 가 연령 라인이라고 **적혀 있어야** 한다(숨은 탈락 금지). */
    expect(m.blockers.map((b) => b.blocker)).toContain("AUDIENCE_LINE");
  });

  /**
   * 🟢🟢 그리고 **사이즈 체계 차이는 이미 비차단** 이다 — 같은 reasons 안에
   *    「사이즈 라인 차이이고 같은 모델로 본다」가 적힌다(WU-045 계약).
   * 🔴 이 사실을 잃지 않는다 — 두 축(SIZE_SYSTEM ↔ AUDIENCE_LINE)이 같은 사실을
   *    **서로 다르게** 다루고 있다는 것이 이번 감사의 관측이다.
   */
  it("M1-b 🟢 사이즈 체계 차이(AGE ↔ MONTH)는 **막지 않는다**", () => {
    const baby = facts({ sizeLabels: ["6M", "12M"], audienceSignals: ["children"] });
    const m = compareCrossSellerProducts(ORIGIN, baby);
    expect(m.blockers.map((b) => b.blocker)).not.toContain("SIZE_SYSTEM");
    expect(JSON.stringify(m.reasons)).toContain("사이즈");
  });
});

describe("AGE-LINE-01 M2 — 실제로 다른 상품은 **여전히 보호** 된다", () => {
  /** 🔴 그래픽 이름이 다르면 baby 표현과 무관하게 동일상품이 아니다(WU-143 반례의 모양). */
  it("M2-a 🔴 디자인명이 다르면 SAME/PRESUMED 가 되지 않는다", () => {
    const other = facts({
      title: "Bobo Choses Baby Booty Ghosts T-Shirt",
      coreTitleTokens: ["baby", "booty", "ghosts", "shirt"],
      sizeLabels: ["6M"],
      audienceSignals: ["baby"],
    });
    const m = compareCrossSellerProducts(ORIGIN, other);
    expect(m.verdict).not.toBe("SAME");
  });

  /**
   * 🟢🟢 실측(bornyesterdaykids) — **세트 상품** 은 `COMPOSITION` 충돌로 막힌다.
   *    CEO 가 SAME 이라 라벨했지만 그 페이지 제목은
   *    「… T-shirt **& Booo Bo Choses Denim Pants Set**」 이다 ⟹ 코드가 맞다.
   */
  it("M2-b 🟢 세트 구성이 다르면 **CONFLICT** 다(정상 보호)", () => {
    const set = facts({
      title: "Bobo Choses Baby Hug Hairy Monster l/s T-shirt & Denim Pants Set",
      coreTitleTokens: ["baby", "hug", "hairy", "monster", "shirt", "denim", "pants", "set"],
      categoryText: "03 Infant Boy",
      colorText: "blue",
      materialText: null,
      fitText: null,
    });
    const m = compareCrossSellerProducts(ORIGIN, set);
    expect(m.verdict).toBe("CONFLICT");
    expect(m.conflicts.map((c) => c.conflict)).toContain("COMPOSITION");
  });
});

describe("AGE-LINE-01 M3/M4 — 🔴🔴 AB/AC 품번 차이의 «현재» 동작을 고정한다", () => {
  /**
   * 🔴🔴🔴 **이것이 이번 감사의 핵심 관측이다.**
   *
   * 실측(bobochoses.com 공식몰 · B226AB040):
   * ```
   * form      T-shirts            == 원상품
   * color     light blue          == 원상품
   * material  Organic Cotton 100% == 원상품 (글자 그대로)
   * fit       loose fit           == 원상품
   * tokens    hug hairy monster shirt == 원상품 (완전 동일)
   * code      B226AB040           != B226AC009   ← 다른 것은 이것 하나
   * ```
   * 그런데 `reasons` 가 **「충돌: 모델코드 …」 한 줄뿐** 이다 — 일치하는 다섯 축이
   * **하나도 적히지 않는다**. 즉 품번 충돌이 나면 **다른 축을 세지 않는다**.
   *
   * 🔴 이 계약은 그 사실을 **고정만** 한다. 정책이 열리면 FAIL 로 뒤집힌다.
   * 🔴 「과도하다」를 코드로 판단하지 않았다 — **CPO/CEO 정책 결정** 이다(§16 STOP A).
   */
  it("M3 🟢 품번 충돌 + 핵심 상품명 완전 일치 → **조기 차단되지 않는다**", () => {
    const ab = facts({ brandModelCode: "B226AB040", sizeLabels: ["6M", "12M"] });
    const m = compareCrossSellerProducts(ORIGIN, ab);
    /** 🟢 CONFLICT 로 즉시 끝나지 않는다 — 나머지 Evidence 가 판단에 참여한다. */
    expect(m.verdict).not.toBe("CONFLICT");
    /** 🔴🔴 **그래도 SAME 은 아니다** — 「AB/AC 를 SAME 으로 만드는 규칙이 아니다」(CPO). */
    expect(m.verdict).not.toBe("SAME");
    expect(m.verdict).toBe("PRESUMED_SAME");
    /** 🔴 품번이 달랐다는 **사실은 그대로 적힌다** — 셀러가 사유를 잃지 않는다. */
    expect(m.conflicts.map((c) => c.conflict)).toContain("MODEL_CODE");
    expect(m.blockers.map((b) => b.blocker)).toContain("MODEL_CODE_AGE_LINE");
    /** 🟢🟢 그리고 **일치하는 축이 이제 세어진다** — 그것이 이 정책의 목적이다. */
    expect(m.reasons.filter((r) => r.startsWith("근거")).length, JSON.stringify(m.reasons)).toBeGreaterThan(0);
    /** 🔴 품번으로 점수를 주지 않는다 — MODEL_CODE 축은 0점이다. */
    expect(m.axes.map((a) => a.axis)).not.toContain("MODEL_CODE");
  });

  /**
   * 🔴🔴 **예외는 「MODEL_CODE 하나뿐일 때」만 발화한다.** 다른 충돌이 같이 있으면
   *    기존 조기 반환이 그대로 일어난다 — 그것이 보호가 살아 있는 방식이다.
   */
  it("M3-c 🔴 색상 충돌이 같이 있으면 **예외가 발화하지 않는다**", () => {
    const other = facts({ brandModelCode: "B226AB040", colorText: "red" });
    const m = compareCrossSellerProducts(ORIGIN, other);
    expect(m.verdict).toBe("CONFLICT");
    expect(m.conflicts.map((c) => c.conflict)).toContain("COLOR");
    expect(m.conflicts.map((c) => c.conflict)).toContain("MODEL_CODE");
  });

  /** 🔴 핵심 상품명이 **한 토큰이라도 다르면** 예외가 발화하지 않는다(cemarose 실측 모양). */
  it("M3-d 🔴 토큰이 하나라도 더 있으면 **CONFLICT 유지**(부분 일치 금지)", () => {
    const extra = facts({
      brandModelCode: "B226AB040",
      coreTitleTokens: ["hug", "hairy", "monster", "shirt", "light"],
    });
    const m = compareCrossSellerProducts(ORIGIN, extra);
    expect(m.verdict).toBe("CONFLICT");
    expect(m.conflicts.map((c) => c.conflict)).toContain("MODEL_CODE");
  });

  /**
   * 🔴🔴 **연령 어휘 제거가 이 정책의 핵심 부품이다**(실측 junioredition 모양).
   *    후보 제목이 「Hug Hairy Monster **Baby** T-Shirt」라 토큰이 하나 더 많다.
   *    그 낱말이 **연령 어휘** 이므로 빼고 비교해야 예외가 발화한다.
   * 🟢 「연령 어휘인가」는 이미 있는 owner `resolveAudienceLine` 이 판단한다(새 사전 0).
   */
  it("M3-e 🟢 차이가 **연령 낱말 하나뿐** 이면 예외가 발화한다", () => {
    const babyWord = facts({
      brandModelCode: "B226AB040",
      coreTitleTokens: ["hug", "hairy", "monster", "baby", "shirt"],
    });
    const m = compareCrossSellerProducts(ORIGIN, babyWord);
    expect(m.verdict, JSON.stringify(m.reasons)).not.toBe("CONFLICT");
    expect(m.blockers.map((b) => b.blocker)).toContain("MODEL_CODE_AGE_LINE");
  });

  /** 🟢 M4 — 품번이 다르고 **실제로 다른 상품** 이면 당연히 낮은 등급이 유지된다. */
  it("M4 🟢 품번 차이 + 실제 다른 상품 → 낮은 등급 유지", () => {
    const diff = facts({
      brandModelCode: "B226AB999",
      title: "Bobo Choses Pop Sweatshirt",
      coreTitleTokens: ["pop", "sweatshirt"],
      categoryText: "Sweatshirts",
      colorText: "off white",
    });
    const m = compareCrossSellerProducts(ORIGIN, diff);
    expect(["CONFLICT", "SIMILAR", "UNKNOWN"]).toContain(m.verdict);
  });

  /**
   * 🔴 후보 자체는 **버려지지 않는다**(CPO §2 「후보 자체는 보존」).
   *    CONFLICT 여도 verdict 가 **달려서** 나오므로 화면이 그 사유를 말할 수 있다.
   */
  it("M3-b 🟢 CONFLICT 라도 **사유가 남는다** — 조용히 사라지지 않는다", () => {
    const ab = facts({ brandModelCode: "B226AB040" });
    const m = compareCrossSellerProducts(ORIGIN, ab);
    expect(m.conflicts.length, "품번 충돌 사실이 사라졌다").toBeGreaterThan(0);
    expect(JSON.stringify(m.reasons)).toContain("B226AB040");
  });
});
