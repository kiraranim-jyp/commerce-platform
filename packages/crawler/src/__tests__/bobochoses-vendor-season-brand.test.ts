import { describe, expect, it } from "vitest";
import { resolveBrandName } from "../brand-resolver";
import fixture from "./fixtures/bobochoses-b226ac114.json";

/**
 * P0-C.2(CEO 지시, 2026-09-18) — 「AW26이 브랜드로 보인다」의 원인을 «재현»으로
 * 고정한다. CEO가 「브랜드 오인식」이라는 내 이전 단정을 폐기하라고 했고, 실제로
 * 조사해 보니 그 단정이 틀렸다.
 *
 * ── 실측 (2026-09-18, 원본 Shopify JSON 직접 조회) ─────────────────────────
 *   vendor       "AW26"                                    ← 🔴 원본이 그렇게 말한다
 *   title        "Bobo Choses Bolder half zipped sweatshirt"  ← 브랜드는 제목에 있다
 *   tags         "aw26, branded, children, clothing, ..."
 *   variant sku  "B226AC11405101"
 *
 * 즉 파서가 브랜드를 잘못 «읽은» 것이 아니다. 이 스토어는 브랜드 자기 소유라
 * Shopify `vendor` 칸을 시즌코드로 쓰고 있고, shopify-product-json.ts가
 * `brand: product.vendor`로 그대로 옮긴다. 우리 쪽 «오인식»이 아니라 원본
 * 필드의 «용도가 다른» 경우다 — 고칠 자리가 다르다.
 *
 * 그래서 REWORK-12 ④가 brand-resolver에 WHOLE_STRING_SEASON_CODE를 넣었다.
 * 이 테스트는 그 방어가 **실제 원본 픽스처로** 작동하는지 고정한다.
 *
 * 🔴 브랜드를 지어내지 않는다. 결과는 빈 문자열이고, 화면은 「브랜드 · 입력
 *    필요」라고 사실대로 말해야 한다. "Bobo Choses"를 제목에서 잘라 넣는 것은
 *    추론이므로 여기서 하지 않는다(CEO 금지 3: 값이 없는데 임의 생성 금지).
 */

describe("원본 픽스처 — vendor 칸에 브랜드가 아니라 시즌코드가 들어 있다", () => {
  it("픽스처의 vendor 는 실제로 시즌코드다", () => {
    expect((fixture as { vendor: string }).vendor).toBe("AW26");
  });

  it("브랜드는 제목에 있다 — 즉 원본이 브랜드를 안 준 것이 아니라 «다른 칸»에 뒀다", () => {
    expect((fixture as { title: string }).title).toContain("Bobo Choses");
  });
});

describe("resolveBrandName 은 시즌코드를 브랜드로 통과시키지 않는다", () => {
  it("AW26 → 빈 문자열 (지어내지 않는다)", () => {
    const resolution = resolveBrandName("AW26");
    expect(resolution?.cleaned, "시즌코드가 브랜드로 새어 나갔다").toBe("");
    expect(resolution?.changed).toBe(true);
    expect(resolution?.ruleApplied).toContain("SEASON_CODE");
  });

  it("다른 시즌 표기도 같이 막는다", () => {
    for (const raw of ["SS26", "FW25", "AW 26", "Spring26"]) {
      expect(resolveBrandName(raw)?.cleaned, `${raw} 가 브랜드로 통과했다`).toBe("");
    }
  });

  it("🔴 진짜 브랜드는 건드리지 않는다 — 과잉 차단 회귀 방지", () => {
    for (const raw of ["Bobo Choses", "New Balance", "Konges Sløjd", "PèPè"]) {
      expect(resolveBrandName(raw)?.cleaned, `${raw} 가 잘려 나갔다`).toBe(raw);
    }
  });

  it("브랜드 뒤에 붙은 시즌코드는 «브랜드만» 남긴다", () => {
    expect(resolveBrandName("Bobo Choses SS26")?.cleaned).toBe("Bobo Choses");
  });
});
