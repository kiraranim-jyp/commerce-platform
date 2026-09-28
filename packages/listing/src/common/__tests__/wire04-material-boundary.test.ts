import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveNoticeFieldValue } from "../../notice/reference-eligibility";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WIRE-04 소재 — **색상과 «같은 결론, 다른 이유» 가 하나 더 있다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 조사 결과 ─────────────────────────────────────────────────────────────
 * 고시 쪽은 색상과 똑같다. Commerce 계층에 폴백 사다리가 없다 —
 *
 *   쿠팡    coupang/build-payload.ts:1421  `product.material.value || undefined`
 *   롯데ON  lotteon/_lib/build-context:214 `product.material.value`
 *   네이버  naver/build-payload.ts:692·738 `resolveNoticeFieldValue("material", …)`
 *
 * 그래서 `resolveCommonMaterial()` 을 만들지 «않는다». 공통화할 사다리가 없으면
 * 공통 함수를 만들지 않는다(WIRE-03 에서 확정한 원칙).
 *
 * ── 🔴 그런데 소재에는 색상에 없던 것이 둘 있다 ──────────────────────────
 *
 * ① **Master 생성 단계의 사다리** — `api/pipeline/canonical-product.ts`
 *    `productData.material || extractMaterial(productData.description) || ""`
 *    이것은 «상품 사실을 만드는» 단계이지 Commerce 매핑이 아니다. Commerce
 *    계층으로 끌어올리지 않는다 — 계층을 섞으면 채널이 크롤러 일을 하게 된다.
 *
 * ② **네이버 전용 속성 매핑** — `naver/attribute-resolver.ts`
 *    `MATERIAL_KEYWORD_MAP` 이 「cotton → 면」처럼 원문을 네이버 속성값 이름으로
 *    옮기고, `valueByName(attr, …)` 이 **채널이 준 속성 목록에서만** 찾는다.
 *    목록에 없으면 그냥 건너뛴다 — 값을 만들지 않는다.
 *
 *    🔴 이것은 「Commerce 표현 방식」이라 Commerce 에 남아야 한다. Common 으로
 *    올리면 우리가 소재 사전을 갖게 되고, 그 순간 채널마다 다른 속성 체계를
 *    우리가 대신 판단하게 된다.
 *
 * ── 🔴 그리고 같은 값이 네이버에서 «두 갈래» 로 나간다 ──────────────────
 *
 *     고시   원문 그대로            "17% Recycled Cotton"
 *     속성   매핑된 채널 값          "면"
 *
 * 둘을 섞으면 고시에 「면」이 나가거나 속성에 원문이 나간다. 이 파일이 그
 * 경계도 함께 고정한다.
 */

const LISTING = join(__dirname, "..", "..");
const ADMIN = join(LISTING, "..", "..", "..", "apps", "admin", "src", "app", "api");
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
/** 🔴 주석을 벗기고 본다 — 같은 함정에 여덟 번 걸렸다. */
const codeOf = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const COUPANG = read(join(LISTING, "coupang", "build-payload.ts"));
const NAVER = read(join(LISTING, "naver", "build-payload.ts"));
const NAVER_ATTR = read(join(LISTING, "naver", "attribute-resolver.ts"));
const LOTTEON_CTX = read(join(ADMIN, "lotteon", "_lib", "build-context.ts"));

describe("① 고시 소재는 «단일 출처» 다 — Commerce 계층에 사다리가 없다", () => {
  it("쿠팡", () => {
    expect(codeOf(COUPANG)).toContain("material: product.material.value || undefined");
  });

  it("롯데ON", () => {
    expect(codeOf(LOTTEON_CTX)).toContain("material: product.material.value");
  });

  it("네이버 — 같은 필드를 참조 대체를 거쳐서 본다", () => {
    expect(codeOf(NAVER)).toContain('resolveNoticeFieldValue("material", product.material)');
  });
});

describe("🔴 ② 「상세페이지 참조」는 네이버 «만» 의 길이다 (색상과 동일 · CPO 보류 보호)", () => {
  it("값이 있으면 셋 다 같은 값이다", () => {
    expect(resolveNoticeFieldValue("material", { value: "17% Recycled Cotton", source: "ORIGINAL", confidence: 1 })).toBe(
      "17% Recycled Cotton",
    );
  });

  it("값이 없고 «참조» 를 골랐을 때만 대체한다", () => {
    expect(
      resolveNoticeFieldValue("material", { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 }),
    ).toBe("상품 상세페이지 참조");
    expect(resolveNoticeFieldValue("material", { value: "", source: "ORIGINAL", confidence: 1 })).toBeUndefined();
  });

  it("🔴 롯데ON·쿠팡은 그 길을 쓰지 않는다", () => {
    expect(codeOf(LOTTEON_CTX)).not.toContain("resolveNoticeFieldValue");
    expect(codeOf(COUPANG)).not.toContain("resolveNoticeFieldValue");
  });
});

describe("🔴 ③ 소재 «사전» 은 Commerce 에 남는다 — Common 으로 올리지 않는다", () => {
  it("키워드 표는 네이버 속성 resolver 안에 있다", () => {
    expect(codeOf(NAVER_ATTR)).toContain("MATERIAL_KEYWORD_MAP");
  });

  it("🔴 공통 폴더에 소재 사전이 «없다»", () => {
    const common = read(join(LISTING, "common", "origin.ts")) + read(join(LISTING, "common", "manufacturer.ts"));
    const code = codeOf(common);
    for (const token of ["MATERIAL_KEYWORD", "폴리에스테르", "캐시미어", "인조가죽"]) {
      expect(code).not.toContain(token);
    }
  });

  it("🔴 매핑은 «채널이 준 목록» 에서만 고른다 — 없으면 건너뛴다", () => {
    const code = codeOf(NAVER_ATTR);
    /* valueByName(attr, value) 가 채널 메타데이터에서 찾는다.
       못 찾으면 matched 에 넣지 않는다 — 값을 지어내지 않는다. */
    expect(code).toContain("const found = valueByName(attr, value);");
    expect(code).toContain("if (found &&");
  });
});

describe("🔴 ④ 고시와 속성이 «섞이지 않는다» — 같은 값이 두 갈래로 나간다", () => {
  it("고시에는 원문이 그대로 간다", () => {
    const raw = "17% Recycled Cotton";
    expect(resolveNoticeFieldValue("material", { value: raw, source: "ORIGINAL", confidence: 1 })).toBe(raw);
  });

  it("🔴 고시 경로가 속성 매핑을 부르지 않는다", () => {
    /* naver/build-payload 의 고시 줄이 키워드 표를 쓰면 고시에 「면」이 나간다. */
    expect(codeOf(NAVER)).not.toContain("MATERIAL_KEYWORD_MAP");
    expect(codeOf(NAVER)).not.toContain("resolveMaterialAttribute");
  });
});

describe("🔴 ⑤ Master 생성 단계의 사다리를 Commerce 로 끌어올리지 않는다", () => {
  it("채널 코드가 원문 추출 함수를 부르지 않는다", () => {
    for (const source of [COUPANG, NAVER, LOTTEON_CTX]) {
      expect(codeOf(source)).not.toContain("extractMaterial");
    }
  });
});
