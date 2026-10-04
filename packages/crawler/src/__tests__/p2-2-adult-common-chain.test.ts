import { describe, expect, it } from "vitest";
import {
  extractAge,
  extractCareInstructions,
  extractColor,
  extractCountryOfOrigin,
  extractManufacturer,
  extractMaterial,
} from "../description-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-2 ②③ — 성인의류도 **같은 공통 추출기** 로 채워진다 (CPO 지시, 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 성인 전용 로직을 만들지 «않았다». 이 파일이 재는 것은 「아동의류가 쓰는 그
 * 함수들에 상세설명을 넣으면 성인 상품도 채워지는가」다.
 *
 * 실측으로 좁힌 원인: tennis-warehouse 는 JSON-LD 0개 · og:* 0개이고 본문이
 * schema.org microdata 로만 있는데, microdata 추출기가 `description` 만 읽지
 * 않았다. 그래서 상세설명이 비고 — **그 아래 공통 추출기 전부가 undefined 였다**
 * (전부 description 을 입력으로 받는다). 한 줄이 사슬 전체를 막고 있었다.
 *
 * 🔴 아래 문자열은 실제 페이지(Magro Long Sleeve)에서 추출된 그대로다. 손으로
 * 다듬지 않았다 — 「Moisture Wicking」이 두 번 나오는 것도 페이지의 실제 마크업이다.
 */
const MAGRO_DESCRIPTION = [
  "Overview",
  "Key Features",
  "Moisture Wicking",
  "Moisture Wicking",
  "",
  "This Sergio Tacchini Men's Magro Long Sleeve has sporty style for chilly court days. It features a classic pique fabric, contrast inserts on the shoulders, side hem vents, moisture wicking performance, and an embroidered Sergio Tacchini logo on the left chest.",
  "",
  "Content: 96% Polyester, 4% Elastane",
  "Crewneck",
  "Pique construction",
  "Moisture wicking",
  "Colors: Brilliant White",
  "",
  "Model is 6'2\" and 170 lbs. He is wearing size Medium.",
].join(String.fromCharCode(10));

describe("① 🔴 상세설명이 열리면 공통 추출기가 따라 채운다", () => {
  it("소재 — 원문 그대로", () => {
    expect(extractMaterial(MAGRO_DESCRIPTION)).toBe("96% Polyester, 4% Elastane");
  });

  it("🔴 색상 — `Colors:` 복수형도 읽는다", () => {
    /* 단수형만 보던 기존 패턴이 이 원문을 놓쳤다. `s?` 한 글자를 더했다. */
    expect(extractColor(MAGRO_DESCRIPTION)).toBe("Brilliant White");
  });
});

describe("② 🔴 없는 것을 «지어내지» 않는다 — 이것이 더 중요하다", () => {
  it("원산지가 원문에 없으면 undefined — 국가를 추측하지 않는다", () => {
    expect(extractCountryOfOrigin(MAGRO_DESCRIPTION)).toBeUndefined();
  });

  it("세탁방법이 없으면 undefined — 「케어라벨 참조」는 UX 층이 정한다", () => {
    expect(extractCareInstructions(MAGRO_DESCRIPTION)).toBeUndefined();
  });

  it("제조사가 없으면 undefined — 브랜드명을 제조사로 쓰지 않는다", () => {
    const m = extractManufacturer(MAGRO_DESCRIPTION);
    expect(m).not.toBe("Sergio Tacchini");
  });

  it("🔴 성인 상품이라 사용연령이 없다 — 아동 값을 만들어 넣지 않는다", () => {
    expect(extractAge(MAGRO_DESCRIPTION)).toBeUndefined();
  });
});

describe("③ 🔴 기존 단수형·아동 원문이 여전히 통과한다 (회귀)", () => {
  it("`Color: Blue` 단수형", () => {
    expect(extractColor("Color: Blue.")).toBe("Blue");
  });

  it("`Colour - Green` 영국식 단수형", () => {
    expect(extractColor("Colour - Green.")).toBe("Green");
  });

  it("아동 원문의 나이대·원산지는 그대로 잡힌다", () => {
    expect(extractAge("Size 2-3 years")).toBeTruthy();
    expect(extractCountryOfOrigin("Made in Vietnam.")).toBeTruthy();
  });
});

describe("④ 🔴 microdata 추출기가 description 을 읽는다", () => {
  it("소스 파일에 description 배선이 있다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    /* 🔴 주석을 벗기고 본다 — 이 변경을 «설명하는» 주석이 같은 파일에 길게 있다. */
    const code = readFileSync(join(__dirname, "../product-data-extractor.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain('document.querySelector(\'[itemprop="description"]\')');
    /* 🔴 사슬이 «세 토막» 이라 세 개를 다 본다: 읽고 → raw 에 담고 → 반환한다.
       처음에는 가운데 토막만 지워도 이 테스트가 통과했다 — 음성 대조가 그 구멍을
       드러냈다. 반환문만 보면 「읽기는 하는데 담지 않는」 상태를 놓친다. */
    expect(code).toContain("const descriptionRaw =");
    expect(code).toContain("description: attr(descEl,");
    expect(code).toContain("description: raw.description,");
    /* 🔴 사이트 전용 class 를 공통 추출기에 적지 않았다. */
    expect(code).not.toContain("product-description");
    expect(code).not.toContain("tennis-warehouse");
  });
});
