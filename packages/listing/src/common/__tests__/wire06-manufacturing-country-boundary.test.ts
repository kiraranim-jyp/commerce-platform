import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ORIGIN_SOURCE_POLICY, resolveCommonOrigin } from "../origin";
import { MANUFACTURER_LOOKUP_ORDER } from "../manufacturer";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.4-D STEP ③-9(CPO 지시, 2026-10-08) — **「제조국」은 브랜드에서 오지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 «지금 있는 기능» 을 지키는 것이 아니라 **없는 것이 계속 없도록**
 *    지킨다. 실측(STEP ③-8): 브랜드 → 제조국 경로는 현재 **존재하지 않는다**.
 *    위험은 미래에 제조국 기능을 만들 때 그 fallback 을 넣는 것이다.
 *
 * 사고의 모양(CEO 가 지적한 실제 사례):
 *
 *     Sergio Tacchini  →  「이탈리아 브랜드」  →  제조국 Italy      🔴
 *     실제                 브랜드 원산지 Italy · 제조국 Vietnam
 *
 * 🔴 **중복을 만들지 않았다.** `common-origin.test.ts` 가 이미 잠근 것은 여기
 *    다시 적지 않는다 — `ORIGIN_SOURCE_POLICY.defaultAllowed === false`(그 파일
 *    ②), `source` 와 `provenance` 를 섞지 않는 것(그 파일 ①)은 그쪽에 있다.
 *    이 파일이 더하는 것은 **「제조국」이라는 «별도 개념» 으로의 전이 금지** 뿐이다.
 *
 * 🔴 새 harness 를 만들지 않았다(CPO 금지). 기존 `resolveCommonOrigin` 과
 *    `MANUFACTURER_LOOKUP_ORDER` 를 그대로 쓰고, 소스 스캔은 파일을 읽는다.
 */

/** 🔴 주석을 벗긴 뒤 본다 — 여덟 번 걸린 함정(소스 문자열 검사는 주석을 벗기고). */
function strippedSource(relativeFromCommon: string): string {
  const abs = path.join(__dirname, "..", relativeFromCommon);
  return readFileSync(abs, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("🔴 ① 브랜드 원산지가 «제조국» 으로 전이되지 않는다", () => {
  /** CPO 지시서 테스트 2 의 입력 그대로. */
  const BRAND_ONLY = {
    product: { value: null, source: undefined },
    brandDefault: "Italy",
    sellerDefault: "Italy",
  } as const;

  it("브랜드 기본값이 쓰이면 그 사실이 «출처로» 남는다 — 상품 사실로 승격되지 않는다", () => {
    const field = resolveCommonOrigin(BRAND_ONLY);
    expect(field.value).toBe("Italy");
    // 🔴 핵심: COMMON_PRODUCT 가 «아니다». 상품에서 확인된 사실이 아니다.
    expect(field.source).not.toBe("COMMON_PRODUCT");
    expect(field.source).toBe("SELLER_SETTINGS");
    // 🔴 provenance 는 「상품에서 온 값일 때만」 채워진다 — 비어 있어야 한다.
    expect(field.provenance).toBeUndefined();
    // 🔴 그리고 왜 그 값인지 문장으로 남는다(셀러가 읽을 수 있어야 한다).
    expect(field.reason).toContain("브랜드");
  });

  it("🔴 브랜드 기본값만 있을 때 「상품에서 확인됨」 문구가 나오지 않는다", () => {
    const field = resolveCommonOrigin(BRAND_ONLY);
    expect(field.reason).not.toContain("상품정보에서 확인된");
  });

  it("상품에 값이 있으면 브랜드가 덮지 못하고, 그때만 provenance 가 ORIGINAL 이다", () => {
    const field = resolveCommonOrigin({ ...BRAND_ONLY, product: { value: "Vietnam", source: "ORIGINAL" } });
    expect(field.value).toBe("Vietnam");
    expect(field.source).toBe("COMMON_PRODUCT");
    expect(field.provenance).toBe("ORIGINAL");
  });

  /**
   * 🔴 **제조국 정책이 생길 때 지켜야 할 조건을 지금 못박는다**(CPO ① 결정).
   *    현재 제조국 정책 파일은 없다 — 그래서 ORIGIN 정책을 그대로 베끼면
   *    `SELLER_SETTINGS` 가 제조국 근거가 된다. 그것을 금지한다.
   */
  it("🔴 ORIGIN 정책은 SELLER_SETTINGS 를 허용한다 — 제조국은 이것을 그대로 쓰면 «안 된다»", () => {
    expect(ORIGIN_SOURCE_POLICY.allowedSources).toContain("SELLER_SETTINGS");
    // 즉 ORIGIN 정책을 제조국에 재사용하는 것은 설계상 금지다. 이 단언은 그
    // 사실을 코드에 남겨 두는 역할이다 — 제조국 정책을 새로 만들 때 이 줄을
    // 보고 `allowedSources` 를 좁혀야 한다는 것을 알 수 있다.
    expect(ORIGIN_SOURCE_POLICY.defaultAllowed).toBe(false);
  });
});

describe("🔴 ② 제조사(브랜드명 fallback 포함)가 제조국 입력이 되지 않는다", () => {
  it("🔴 제조사 출처 목록에 «국가» 를 뜻하는 값이 하나도 없다", () => {
    expect(MANUFACTURER_LOOKUP_ORDER.length).toBeGreaterThan(0);
    for (const source of MANUFACTURER_LOOKUP_ORDER) {
      expect(String(source)).not.toMatch(/COUNTRY|ORIGIN|NATION/i);
    }
  });

  it("🔴 manufacturer.ts 가 원산지/제조국 어휘를 «값으로» 쓰지 않는다", () => {
    const src = strippedSource("manufacturer.ts");
    // 제조사 모듈이 countryOfOrigin 을 읽으면 그 순간 브랜드 국가가 제조국으로
    // 번질 입구가 생긴다. 지금은 없고, 계속 없어야 한다.
    expect(src).not.toMatch(/countryOfOrigin/);
    expect(src).not.toMatch(/manufacturingCountry/);
  });

  it("🔴 origin.ts 가 제조사/브랜드명을 «값으로» 쓰지 않는다", () => {
    const src = strippedSource("origin.ts");
    // brandDefault(브랜드 «원산지» 기본값)는 허용된 입력이다. 금지하는 것은
    // 브랜드 «이름» 이나 제조사 «이름» 이 원산지 값으로 들어오는 것이다.
    expect(src).not.toMatch(/input\.manufacturer/);
    expect(src).not.toMatch(/\bbrandName\b/);
  });
});

describe("🔴 ③ 「제조국」 개념은 아직 없다 — 조용히 생기지 않게 한다", () => {
  /**
   * 🔴 이 단언은 «기능을 막는» 것이 아니라 **순서를 강제한다**(CPO ③-8 보류선).
   *    제조국 필드를 만들려면 먼저 「Made in X ≠ 원산지 X」 추출 분리가 선행돼야
   *    한다. 그 전에 필드가 생기면 `countryOfOrigin` 의 복사본이 된다.
   *
   *    이 테스트가 FAIL 하면 그것은 「누군가 제조국을 추가했다」는 신호이고,
   *    그때 CPO 보류선 6단계를 다시 읽어야 한다.
   */
  it("common 계층에 MANUFACTURING_COUNTRY concept 이 아직 없다", () => {
    for (const file of ["origin.ts", "manufacturer.ts", "logistics.ts"]) {
      expect(strippedSource(file), `${file} 에 제조국 개념이 생겼다`).not.toMatch(/MANUFACTURING_COUNTRY/);
    }
  });
});
