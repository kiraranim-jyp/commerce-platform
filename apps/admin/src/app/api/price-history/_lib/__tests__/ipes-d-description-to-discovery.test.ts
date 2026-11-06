/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IPES PHASE D — **상세설명 식별정보가 «후보 재발견» 까지 가는가**
 *        (CPO 통합 지시 2026-11-06 · 최종 합격 기준)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 합격 조건을 그대로 옮긴다:
 * ```
 * 「상세설명에서 브랜드·상품명·상품코드를 추출하는 데 그치지 말고,
 *   그 값이 **실제 검색 쿼리와 후보 재발견에 반영됐는지까지** 증명해야 한다.」
 * 「단순히 화면에 추출값을 표시하고 검색에는 사용하지 않는 구현은
 *   완료로 인정하지 않는다.」
 * ```
 *
 * 🟢 그래서 이 파일은 **사슬 전체** 를 한 번에 단언한다 —
 *    `canonicalProduct(설명문에만 품번)` → `buildProductIdentityDna`
 *    → `brandModelCode` → `buildDomesticShopQuery` → `collectDomesticListingUrls`
 *    → **상세 URL 산출**.
 *
 * 🔴 **네트워크 0.** `collectDomesticListingUrls` 가 스스로 제공하는 주입구
 *    (`fetchHtml` · `expand`)를 쓴다 — 그 주석이 「테스트/측정용 주입구」라고
 *    적어 둔 그 자리다. 🔴 새 주입구를 만들지 않았다.
 *
 * 🔴 **판정 축은 건드리지 않는다** — 이 파일은 `compareCrossSellerProducts` ·
 *    `deriveMatchTruth` · `priceTierFromLink` · threshold · blocker · 가격 자격을
 *    **한 번도 부르지 않는다**. 증명 대상은 **발견** 뿐이다.
 */
import { describe, expect, it } from "vitest";
import { buildProductIdentityDna, buildDomesticShopQuery } from "@commerce/shared";
import type { CanonicalProduct, ProvenanceField } from "@commerce/shared";
import { collectDomesticListingUrls } from "../domestic-listing-pool";
import type { ListingHopResult } from "../domestic-listing-hop";

function field<T>(value: T): ProvenanceField<T> {
  return { value, source: "ORIGINAL", confidence: 0.9 };
}

/**
 * 🔴 **실측 기반 fixture 다.** 값은 운영 스냅샷
 * `bobochoses.com/en-kr/products/b226ac009-hug-hairy-monster-t-shirt` 에서 왔다 —
 * 🔴 단 **품번을 설명문에만** 두도록 바꿨다(그것이 이 테스트의 대상 조건이다).
 * 🟢 그 모양은 실재한다 — `junioredition.com` 설명문이
 *    「Product code B226AC009 AW26 Made in Portugal.」 라벨을 쓴다(IPES-D 실측).
 */
function originWithCodeOnlyInDescription(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    /** 🔴 slug 에 품번이 **없다** — 있으면 설명문 축을 증명하지 못한다. */
    sourceUrl: "https://www.junioredition.com/products/hug-hairy-monster-tee",
    title: field("Hug Hairy Monster T-shirt"),
    brand: field("Bobo Choses"),
    description: field("Light blue t-shirt. Product code B226AC009 AW26 Made in Portugal."),
    price: field({ amount: 40, currency: "EUR" }),
    priceValidity: "VALID",
    /** 🔴 기본정보의 식별 칸은 **비어 있다** — 실측 그대로(`sku.value === ""`). */
    sku: field(""),
    modelName: field(""),
    material: field(""),
    color: field("Light blue"),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field(""),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field(""),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(0),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    weight: field(""),
    certificationType: field(""),
    ...overrides,
  } as CanonicalProduct;
}

const SITES = [{ domain: "biskuit.kr", entryUrl: "https://biskuit.kr/product/list.html" }];

/** 🟢 주입 HTML — 국내 샵 목록이 **한국어 제목** 과 **URL 안의 품번** 을 같이 내는 모양.
 *  🔴 실측 근거: `littleluna.co.kr` 제목에 `AW26MS185` 가 그대로 있다(ROOTCAUSE-FIX-01). */
const LISTING_HTML = `
  <ul>
    <li><a href="/product/허그-헤어리-몬스터-티셔츠/b226ac009/category/1/display/1/">허그 헤어리 몬스터 티셔츠</a></li>
    <li><a href="/product/다른-상품/9999/category/1/display/1/">전혀 다른 상품</a></li>
  </ul>`;

/**
 * 🔴 `expand` 주입 — robots/sitemap HTTP 를 **타지 않는다**.
 * 🔴🔴 반환 모양은 **`ListingHopResult` 타입을 그대로** 쓴다(칸을 추측하지 않는다 ·
 *    1차에 `host`/`source`/`linkCount` 를 빠뜨려 **typecheck 가 잡았다**).
 */
function expandStub(entryUrl: string, code: string | null): Promise<ListingHopResult> {
  const hit = code ? new RegExp(code, "i") : null;
  const urls = hit
    ? [...LISTING_HTML.matchAll(/href="([^"]+)"/g)]
        .map((m) => new URL(m[1], entryUrl).toString())
        .filter((u) => hit.test(u))
    : [];
  return Promise.resolve({
    host: new URL(entryUrl).hostname,
    robotsAllowed: true,
    source: urls.length > 0 ? "LISTING_HTML" : "NONE",
    linkCount: urls.length,
    detailUrls: urls,
    httpCalls: 1,
    entryHtml: LISTING_HTML,
    note: null,
  });
}

describe("IPES-D — 상세설명 품번 → 국내 검색 쿼리 → 후보 재발견", () => {
  it("🟢🟢 ① 설명문에만 있는 품번이 DNA 의 `brandModelCode` 가 된다", () => {
    const dna = buildProductIdentityDna(originWithCodeOnlyInDescription());
    expect(dna.brandModelCode).toBe("B226AC009");
    /** 🔴 기본정보 쪽은 비어 있었다는 사실을 같이 단언한다(출처 구분). */
    expect(dna.identifier).toBeNull();
  });

  it("🟢🟢 ② 그 품번이 **국내 샵 검색 쿼리** 가 된다(화면 표시로 끝나지 않는다)", () => {
    const dna = buildProductIdentityDna(originWithCodeOnlyInDescription());
    expect(buildDomesticShopQuery(dna)).toBe("B226AC009");
  });

  it("🟢🟢 ③ 그 품번으로 목록 hop 이 **상세 URL 을 재발견** 한다", async () => {
    const dna = buildProductIdentityDna(originWithCodeOnlyInDescription());
    const pool = await collectDomesticListingUrls({
      sites: SITES,
      code: dna.brandModelCode,
      brandTerms: [dna.brand.value],
      expand: expandStub,
      fetchHtml: () => Promise.resolve(LISTING_HTML),
    });
    expect(pool.urls.length).toBeGreaterThan(0);
    expect(pool.urls.some((u) => /b226ac009/i.test(u))).toBe(true);
    /** 🔴 **다른 상품을 끌어오지 않는다** — 품번이 없는 href 는 들어오지 않는다. */
    expect(pool.urls.some((u) => /9999/.test(u))).toBe(false);
    expect(pool.metrics.outcomes[0]?.source).toBe("URL_CODE");
    /** 🔴 외부 provider 호출은 **구조상 0** 이다. */
    expect(pool.metrics.providerCalls).toBe(0);
  });

  it("🔴🔴 ④ 반사실 — 상세설명을 비우면 사슬이 **끊긴다**", async () => {
    const dna = buildProductIdentityDna(originWithCodeOnlyInDescription({ description: field("") }));
    /** 🔴 품번이 사라진다 ⟹ 설명문이 **유일 출처** 였다는 직접 증거다. */
    expect(dna.brandModelCode).toBeNull();
    /** 🔴 쿼리가 **영문 제목** 으로 되돌아간다 — 국내 샵에서 토큰이 겹치지 않는 그 축이다. */
    expect(buildDomesticShopQuery(dna)).toBe("Bobo Choses hug hairy monster shirt");
    const pool = await collectDomesticListingUrls({
      sites: SITES,
      code: dna.brandModelCode,
      brandTerms: [dna.brand.value],
      expand: expandStub,
      fetchHtml: () => Promise.resolve(LISTING_HTML),
    });
    /** 🔴 품번이 없으면 hop 은 **아무것도 하지 않는다**(오탐 방지 게이트 · 설계대로). */
    expect(pool.urls).toEqual([]);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════
   * 🔵 CPO §8 테스트 케이스 — 상품별로 **실제 존재하는 정보만** 추출한다
   * ══════════════════════════════════════════════════════════════════════
   */
  describe("CPO §8 — 식별정보 출처별 케이스", () => {
    it("②③ 기본정보에 브랜드/상품명이 없고 상세설명에만 품번이 있어도 쿼리가 선다", () => {
      const dna = buildProductIdentityDna(
        originWithCodeOnlyInDescription({ brand: field(""), title: field("") }),
      );
      expect(dna.brandModelCode).toBe("B226AC009");
      expect(buildDomesticShopQuery(dna)).toBe("B226AC009");
    });

    it("⑤ 기본정보(sku)와 상세설명 품번이 **다르면** 둘을 모두 보존한다 — 하나를 지우지 않는다", () => {
      const dna = buildProductIdentityDna(originWithCodeOnlyInDescription({ sku: field("AAA1804922") }));
      /** 🟢 설명문 품번은 `brandModelCode` 에 **그대로 남는다**. */
      expect(dna.brandModelCode).toBe("B226AC009");
      /** 🟢 기본정보 sku 도 `identifier` 에 **그대로 남는다**. */
      expect(dna.identifier).toEqual({ value: "AAA1804922", tier: "SKU" });
      /** 🔴 **임의로 하나를 고르지 않았다** — 기존 정책(SKU 1순위)이 쿼리를 고른다. */
      expect(buildDomesticShopQuery(dna)).toBe("AAA1804922");
    });

    it("⑥⑦ 품번이 기본정보·상세설명·URL 어디에도 없으면 **지어내지 않는다**", () => {
      const dna = buildProductIdentityDna(
        originWithCodeOnlyInDescription({ description: field("Light blue t-shirt. Organic Cotton 100%.") }),
      );
      expect(dna.brandModelCode).toBeNull();
      /** 🟢 그래도 쿼리는 선다 — 다만 **품번이 아닌** 축으로 선다(폴백 보존). */
      expect(buildDomesticShopQuery(dna)).toBe("Bobo Choses hug hairy monster shirt");
    });

    it("⑧ HTML 표/리스트 안의 품번도 라벨이 살아 있으면 읽힌다", () => {
      /**
       * 🟢 실측으로 확인한 것 — 운영 HTML→텍스트 변환기(`plainText` ·
       *    `seller-facts.ts:31`)가 태그를 **공백으로** 치환한다 ⟹
       *    `<th>Product code</th><td>B226AC009</td>` 가
       *    `"Product code B226AC009"` 가 되어 라벨 정규식이 **그대로 읽는다**.
       * 🔴 그래서 **표 전용 파서를 만들지 않았다**(필요가 측정되지 않았다).
       * 🔴 단 태그를 **빈 문자열로** 지우는 변환기에서는 글자가 붙어 읽히지 않는다 —
       *    운영 경로 전수(7곳)를 확인했고 그 모양은 **단일 요소 내부 텍스트 전용**
       *    두 곳(`littleluna` · `prestashop`)뿐이라 이 축에 영향이 없다.
       */
      const fromTable = "제품 정보 Product code B226AC009 AW26 Made in Portugal.";
      const dna = buildProductIdentityDna(originWithCodeOnlyInDescription({ description: field(fromTable) }));
      expect(dna.brandModelCode).toBe("B226AC009");
    });
  });

  /**
   * 🔴🔴 **이미지 OCR 은 운영 경로에 «없다»** — 저장소 전수 검색에서 `ocr`/`tesseract`
   *    어휘가 **테스트 파일 한 곳** 에만 있고 운영 추출 경로엔 **0** 이다.
   *    ⟹ 🔴 CPO §2-2 의 그 항목은 **미지원 상태로 기록** 한다(지원한다고 적지 않는다).
   *    🟢 그래서 이 테스트는 「이미지에서 글자를 읽는다」를 **단언하지 않는다**.
   */
  it("🔴 이미지 OCR 은 미지원이다 — 텍스트 축과 분리해 기록한다", () => {
    const dna = buildProductIdentityDna(
      originWithCodeOnlyInDescription({ description: field("Light blue t-shirt.") }),
    );
    /** 🔴 이미지에 품번이 있더라도 우리는 읽지 못한다 ⟹ null 이 **정확한 상태** 다. */
    expect(dna.brandModelCode).toBeNull();
  });
});
