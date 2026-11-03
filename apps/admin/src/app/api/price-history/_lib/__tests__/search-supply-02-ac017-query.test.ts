import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCH-SUPPLY-02 — **B226AC017 의 «실제» query 원문을 찍는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO ①(2026-11-03): 「전략상 들어가 있다」가 아니라 **이번 상품의 실제 질의** 를 본다.
 * ```
 * brand / model code / product name / product facts / "국내해외 동일상품 판매처"
 * ```
 * 🔴 **검색을 보내지 않는다**(과금 0) — 원상품 1회 추출 + **순수 조립기** 뿐이다.
 * 🔴 운영 호출부(`run-domestic-price-check.ts`)의 **칸 옮기기를 그대로 베낀다** —
 *    여기서 문자열을 조립하지 않는다(`ProductIdentity` ≠ `ProductIdentityDna`).
 * 🔴 게이트 `AC017_QUERY=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 */
const LIVE = process.env.AC017_QUERY === "1";
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac017-booo-bo-choses-t-shirt";

describe("SEARCH-SUPPLY-02 — B226AC017 실제 query", () => {
  it.runIf(LIVE)("🔎 운영이 보낼 질의 문자열을 그대로 찍는다", async () => {
    const { shopifySiteStrategy } = await import("@commerce/crawler/src/site-strategies/shopify.site-strategy");
    const { buildProductIdentityDna } = await import("@commerce/shared");
    const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
    const { buildDiscoverySearchQuery } = await import("@commerce/crawler/src/discovery-core/query-planner");

    const extracted = await shopifySiteStrategy.extract(ORIGIN);
    const product = buildCanonicalProduct(ORIGIN, extracted!.productData as never, {} as never, []);
    const dna = buildProductIdentityDna(product);

    /** 🔴 운영 `run-domestic-price-check.ts:1588` 의 칸 모양 그대로. */
    const identity = {
      brand: dna.brand.value || null,
      productName: dna.title || null,
      productType: dna.category?.value ?? null,
      genderAge: null,
      color: dna.color,
      size: null,
      season: null,
      productCode: dna.brandModelCode,
      facts: [dna.material, dna.fit].filter((v): v is string => Boolean(v)),
      sourceUrl: ORIGIN,
      sourceSite: null,
      sourceCountry: null,
      market: null,
    };
    const query = buildDiscoverySearchQuery(identity as never);

    /* eslint-disable no-console */
    console.log(
      "\n═══ B226AC017 운영 질의 ═══\n" +
        `brand        ${JSON.stringify(dna.brand.value)}\n` +
        `productCode  ${JSON.stringify(dna.brandModelCode)}\n` +
        `productName  ${JSON.stringify(dna.title)}\n` +
        `color        ${JSON.stringify(dna.color)}\n` +
        `facts        ${JSON.stringify(identity.facts)}\n` +
        `QUERY        ${JSON.stringify(query)}\n` +
        "═══════════════════════════\n",
    );

    /** 🔴 다섯 요소가 실제로 들어갔는지 **하나씩** 적는다(추정 금지). */
    const has = (s: string | null) => (s ? query?.includes(s) ?? false : null);
    console.log(
      `[요소] brand=${has(dna.brand.value)} code=${has(dna.brandModelCode)} ` +
        `name=${has((dna.title ?? "").split(" ")[0] ?? "")} ` +
        `signal=${query?.includes("국내해외 동일상품 판매처") ?? false}`,
    );

    expect(query, "🔴 질의가 만들어지지 않았다 — NO_MODEL_CODE 로 검색을 못 보낸다").toBeTruthy();
  }, 300_000);
});
