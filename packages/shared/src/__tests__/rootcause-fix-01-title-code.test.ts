import { describe, expect, it } from "vitest";
import { extractCodeLikeSlugSegment, extractCodeLikeTitleToken, extractLabeledProductCode } from "../product-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 ROOTCAUSE-FIX-01 §5 — **제목 품번 추출**(CPO Case A~E)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 실측 근거 — `littleluna.co.kr` 제목에 `AW26MS185` 가 있는데
 *    `brandModelCode` 가 **null** 이었다(E2E-ROOTCAUSE-01).
 * 🟢 새 모양 규칙을 만들지 않았다 — slug 축과 **같은 규칙** 을 쓴다.
 */

describe("ROOTCAUSE-FIX-01 — 제목 품번(Case A~E)", () => {
  it("Case A 🟢 제목의 품번을 읽는다 — 실제 Little Luna 제목", () => {
    expect(
      extractCodeLikeTitleToken("[메인스토리]  AW26MS185 - Bubble Sweatshirt - Grey Melange 8Y"),
    ).toBe("AW26MS185");
  });

  it("Case B 🟢 설명문 라벨 축은 **그대로** 다", () => {
    expect(extractLabeledProductCode("Product code: B226AC009")).toBe("B226AC009");
  });

  it("Case C 🟢 URL slug 축은 **그대로** 다", () => {
    expect(extractCodeLikeSlugSegment("b226ac009-hug-hairy-monster-t-shirt")).toBe("B226AC009");
  });

  /** 🔴 사이즈·시즌을 품번으로 찍지 않는다 — 길이/시작문자 규칙이 구조적으로 막는다. */
  it("Case D 🔴 사이즈·시즌·순수숫자를 품번으로 **만들지 않는다**", () => {
    expect(extractCodeLikeTitleToken("Bubble Sweatshirt 8Y")).toBeNull();
    expect(extractCodeLikeTitleToken("Bubble Sweatshirt FW26")).toBeNull();
    expect(extractCodeLikeTitleToken("Bubble Sweatshirt 2026")).toBeNull();
    expect(extractCodeLikeTitleToken("Bubble Sweatshirt Grey Melange")).toBeNull();
    /** 🔴 숫자로 시작하는 재고번호도 아니다. */
    expect(extractCodeLikeTitleToken("Sweatshirt 700005621LBL")).toBeNull();
  });

  /**
   * 🔴 **동률이면 고르지 않는다** — 코드 모양이 둘이면 하나를 찍는 순간 추측이다.
   */
  it("Case D-2 🔴 같은 길이 후보가 **둘이면 만들지 않는다**", () => {
    expect(extractCodeLikeTitleToken("AW26MS185 and BW26MS186 sweatshirt")).toBeNull();
    /** 🟢 길이가 다르면 **가장 긴 것** 하나를 쓴다. */
    expect(extractCodeLikeTitleToken("AW26MS1850 and BW26MS186")).toBe("AW26MS1850");
  });

  /**
   * 🔴🔴 Case E — **기존 값을 덮어쓰지 않는다.** 우선순위는 라벨 → 제목 → slug 다.
   *    🟢 함수 단위가 아니라 **resolver 의 순서** 가 그 계약이라 소스로 잠근다.
   */
  it("Case E 🔴 우선순위가 **라벨 → 제목 → slug** 로 고정돼 있다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "../product-identity-dna.ts"), "utf8").replace(/\r\n/g, "\n");
    const at = src.indexOf("function resolveBrandModelCode");
    expect(at).toBeGreaterThan(0);
    const body = src.slice(at, src.indexOf("\n}", at));
    const order = (body.match(/extract(LabeledProductCode|CodeLikeTitleToken|CodeLikeSlugSegment)/g) ?? []);
    expect(order, "우선순위가 바뀌었다 — 기존 값을 덮어쓸 수 있다").toEqual([
      "extractLabeledProductCode",
      "extractCodeLikeTitleToken",
      "extractCodeLikeSlugSegment",
    ]);
    /** 🔴 라벨이 값을 내면 **거기서 끝** 이어야 한다(조기 반환). */
    expect(body).toMatch(/if \(labeled\) return labeled;/);
    expect(body).toMatch(/if \(fromTitle\) return fromTitle;/);
  });

  /** 🔴 사이트 전용 분기를 넣지 않았다 — 일반 계층이어야 한다(CPO §6·§16). */
  it("🔴 사이트 전용 분기가 **없다**", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "../product-facts.ts"), "utf8");
    const at = src.indexOf("export function extractCodeLikeTitleToken");
    const body = src.slice(at, at + 1400);
    for (const w of ["littleluna", "cafe24", "main-story", ".co.kr"]) {
      expect(body.toLowerCase(), `사이트 전용 분기가 생겼다: ${w}`).not.toContain(w);
    }
  });
});
