import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
/** 🔴 새 패키지 export 를 만들지 않는다 — 이 저장소의 기존 테스트들이 쓰는 deep path 그대로다. */
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { brandsCompatible } from "@commerce/crawler/src/comparison-search/cross-seller";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **SPRINT 2 후속 — ① URL 오차단 · ② 한글 브랜드 표기**(CPO 승인 2026-11-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측(B226AC038 라이브)이 드러낸 둘을 고친다. 🔴 **둘 다 「완화」가 아니다**:
 * ```
 * ① Nordstrom `/s/<슬러그>/<숫자 id>` 상품 상세가 UNKNOWN_PAGE 라 **요청조차 안 나갔다**
 *    🔴 승인 조건 — 「목록 페이지가 상세로 통과하는 부작용이 생기면 승인하지 않는다」
 * ② 원상품 "Bobo Choses" ↔ 후보 **"보보쇼즈"** 가 BRAND_MISMATCH 였다
 *    🔴 그 표기는 등록부(`brand-alias.ts`)에 **이미 있다** ⟹ 재사용만 한다
 *    🔴 신규 alias 0 · 음역 추론 0 · 품번 단독 SAME 승격 0
 * ```
 */

const CRAWLER = join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search");
const SHAPE = readFileSync(join(CRAWLER, "url-shape.ts"), "utf8").replace(/\r\n/g, "\n");
const CROSS = readFileSync(join(CRAWLER, "cross-seller.ts"), "utf8").replace(/\r\n/g, "\n");
const ALIAS = readFileSync(join(CRAWLER, "brand-alias.ts"), "utf8").replace(/\r\n/g, "\n");

/** 🔴 주석을 벗긴다 — 메모 `source-scan-must-strip-comments`. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}
const SHAPE_CODE = stripComments(SHAPE);
const CROSS_CODE = stripComments(CROSS);
const ALIAS_CODE = stripComments(ALIAS);

/* ═══════════ A. ① 양성 — 실측에서 잃은 그 URL 이 상세로 선다 ═══════════ */

describe("A. `/s/<슬러그>/<숫자 id>` 는 상품 상세다 (실측 손실 복구)", () => {
  it("A-1 🔴 실측에서 탈락한 Nordstrom URL 이 PRODUCT_PAGE 다", () => {
    expect(
      classifyUrlShape("https://www.nordstrom.com/s/bobo-choses-hidden-monster-sweatshirt/9195361"),
    ).toBe("PRODUCT_PAGE");
  });

  it("A-2 쿼리/트래킹이 붙어도 경로만 본다", () => {
    expect(
      classifyUrlShape("https://www.nordstrom.com/s/bobo-choses-hidden-monster-sweatshirt/9195361?origin=keywordsearch"),
    ).toBe("PRODUCT_PAGE");
  });

  it("A-3 끝 슬래시를 허용한다", () => {
    expect(classifyUrlShape("https://shop.example.com/s/hidden-monster-sweatshirt/9195361/")).toBe("PRODUCT_PAGE");
  });

  it("A-4 로케일 접두사가 앞에 와도 선다(세그먼트 경계로 본다)", () => {
    expect(classifyUrlShape("https://shop.example.com/en-us/s/hidden-monster-sweatshirt/123456")).toBe("PRODUCT_PAGE");
  });
});

/* ═══ B. ① 음성 — 🔴 **목록이 상세로 통과하면 CPO 가 승인하지 않는다** ═══ */

describe("B. 🔴 목록·검색·브랜드 페이지는 상세가 «되지 않는다»", () => {
  const MUST_NOT_BE_PRODUCT = [
    /** 🔴 한 낱말 목록 — 하이픈 요구가 이것을 막는다. */
    "https://shop.example.com/s/sale",
    "https://shop.example.com/s/search",
    "https://shop.example.com/s/new",
    /** 🔴 숫자 꼬리가 없다 — 두 번째 요구가 이것을 막는다. */
    "https://shop.example.com/s/hidden-monster-sweatshirt",
    "https://shop.example.com/s/hidden-monster-sweatshirt/color/blue",
    /** 🔴 마지막 세그먼트가 숫자만이 아니다. */
    "https://shop.example.com/s/hidden-monster-sweatshirt/9195361-blue",
    /** 🔴 `s` 가 세그먼트가 아니다(다른 낱말의 일부). */
    "https://shop.example.com/shoes/hidden-monster-sweatshirt/9195361",
    /** 🔴 실측에서 **올바르게** 차단된 둘 — 그 판정이 유지되는지 같이 본다. */
    "https://james-basile.be/en/brands/bobo-choses",
    "https://stitch-house.com/SHOP/129832/112134/list.html",
  ];

  for (const url of MUST_NOT_BE_PRODUCT) {
    it(`B — PRODUCT_PAGE 가 아니다: ${url.replace("https://", "")}`, () => {
      expect(classifyUrlShape(url)).not.toBe("PRODUCT_PAGE");
    });
  }

  it("B-10 🔴 `s` 를 PRODUCT_PATH 토큰 목록에 **넣지 않았다**(한 글자 토큰 사고 재발 금지)", () => {
    const tokens = SHAPE_CODE.match(/const PRODUCT_PATH = \/\(\?:\^\|\\\/\)\(\?:([^)]+)\)/)?.[1] ?? "";
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.split("|")).not.toContain("s");
  });

  it("B-11 🔴 셋을 **동시에** 요구한다 — 세그먼트 `s` · 하이픈 슬러그 · 숫자 꼬리", () => {
    expect(SHAPE_CODE).toMatch(/const PRODUCT_SLUG_NUMERIC_ID = \/\(\?:\^\|\\\/\)s\\\/\[\^\/\]\*-\[\^\/\]\*\\\/\\d\+/);
  });

  it("B-12 🔴 도메인 조건을 쓰지 않았다(사이트 전용 규칙 금지)", () => {
    expect(SHAPE_CODE).not.toContain("nordstrom");
    expect(SHAPE_CODE).not.toContain("hostname");
  });
});

/* ═══════════ C. ② 양성 — 등록부가 아는 한글 표기를 비교가 쓴다 ═══════════ */

describe("C. 등록된 한글 표기는 같은 브랜드로 비교된다", () => {
  it("C-1 🔴 실측에서 막힌 그 쌍이 통과한다", () => {
    expect(brandsCompatible("Bobo Choses", "보보쇼즈")).toBe(true);
    expect(brandsCompatible("보보쇼즈", "Bobo Choses")).toBe(true);
  });

  it("C-2 방향 대칭이고 다른 등록 브랜드에도 같은 규칙이다", () => {
    expect(brandsCompatible("Pèpè Shoes", "페페")).toBe(true);
    expect(brandsCompatible("Emile et Ida", "에밀에이다")).toBe(true);
    expect(brandsCompatible("Konges Slojd Clothing", "콩제슬래드")).toBe(true);
  });

  it("C-3 기존 동작이 그대로다 — 같은 표기·꼬리 제거 경로 불변", () => {
    expect(brandsCompatible("Bobo Choses", "BOBO CHOSES")).toBe(true);
    expect(brandsCompatible("Konges Sløjd A/S", "Konges Sløjd Clothing 30% Off Sale")).toBe(true);
  });
});

/* ═══ D. ② 음성 — 🔴 **다른 브랜드를 같다고 하지 않는다**(완화 금지) ═══ */

describe("D. 🔴 완화가 아니다 — 모르는 이름·다른 브랜드는 그대로 불일치", () => {
  it("D-1 서로 다른 등록 브랜드는 불일치다", () => {
    expect(brandsCompatible("Bobo Choses", "페페")).toBe(false);
    expect(brandsCompatible("보보쇼즈", "콩제슬래드")).toBe(false);
  });

  it("D-2 🔴 등록부가 **모르는** 한글 표기는 불일치다(음역 추론 금지)", () => {
    expect(brandsCompatible("Bobo Choses", "보보초스")).toBe(false);
    expect(brandsCompatible("Bobo Choses", "미샤앤퍼프")).toBe(false);
  });

  it("D-3 🔴 유사품 표기는 거부된다(경계 규칙이 산다)", () => {
    expect(brandsCompatible("Bobo Choses", "보보쇼즈풍")).toBe(false);
    expect(brandsCompatible("Bobo Choses", "보보쇼즈st")).toBe(false);
  });

  it("D-4 🔴 한쪽만 등록부에 있으면 불일치다 — 「모른다」를 「같다」로 읽지 않는다", () => {
    expect(brandsCompatible("Bobo Choses", "Some Random Shop")).toBe(false);
    expect(brandsCompatible("보보쇼즈", "Konges Slojd Clothing")).toBe(false);
  });

  it("D-5 🔴 빈 값·시즌코드는 그대로 불일치다(기존 SEASON_CODE 규칙 보존)", () => {
    expect(brandsCompatible("AW26", "보보쇼즈")).toBe(false);
    expect(brandsCompatible("", "보보쇼즈")).toBe(false);
  });
});

/* ═══════════ E. 구조 — 등록부를 늘리지 않았고, 추출을 바꾸지 않았다 ═══════════ */

describe("E. 기존 자산 재사용만 (CPO 금지 전수)", () => {
  it("E-1 🔴 alias 등록부가 **4건 그대로** 다(신규 등록 0)", () => {
    const entries = ALIAS_CODE.match(/\{\s*brand:\s*"/g) ?? [];
    expect(entries.length).toBe(4);
    expect(ALIAS_CODE).toContain('{ brand: "Bobo Choses", alias: "보보쇼즈" }');
  });

  it("E-2 🔴 비교 함수가 **기존 조회 함수** 를 부른다(새 사전 0)", () => {
    expect(CROSS_CODE).toContain("lookupBrandByAliasInTitle(raw)");
    expect(CROSS_CODE).toContain("isKnownProductBrand(raw)");
  });

  it("E-3 🔴 1차 판정이 참이면 등록부를 **보지 않는다**(기존 경로 불변)", () => {
    const fn = CROSS_CODE.slice(
      CROSS_CODE.indexOf("export function brandsCompatible"),
      CROSS_CODE.indexOf("export function brandsCompatible") + 600,
    );
    expect(fn.indexOf("brandIdentitiesCompatible(resolveBrandIdentity(a), resolveBrandIdentity(b))")).toBeLessThan(
      fn.indexOf("registryCanonicalBrand(a)"),
    );
  });

  it("E-4 🔴 **추출** 은 건드리지 않았다 — facts.brand 를 등록부 이름으로 바꿔 쓰지 않는다", () => {
    const facts = stripComments(readFileSync(join(CRAWLER, "product-url-facts.ts"), "utf8"));
    /** 🟢 기존 **폴백**(브랜드가 없을 때만)은 그대로여야 한다. */
    expect(facts).toContain("lookupBrandByAliasInTitle");
    /** 🔴 읽은 브랜드를 등록부 이름으로 **치환** 하는 코드가 생기면 FAIL 이다. */
    expect(facts).not.toMatch(/brand\s*=\s*registryCanonicalBrand/);
    expect(facts).not.toContain("isKnownProductBrand");
  });

  it("E-5 🔴 품번 단독 SAME 승격이 없다 — 이 변경은 **브랜드 축 하나** 만 건드린다", () => {
    expect(CROSS_CODE).not.toMatch(/codeEvidence === "exact"\s*\)\s*return\s*\{?\s*verdict:\s*"SAME"/);
    expect(CROSS_CODE).not.toContain("SAME_MIN_AXES = 4");
  });
});
