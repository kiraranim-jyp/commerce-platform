/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02l STEP 7 — **이 수정이 Production 판정까지 닿는가.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 지난 페이지에서 확정된 최상위 제약: 「값이 실제 Production 까지 들어가는가」를
 *    먼저 본다. `buildPrompt` 는 `ProductIdentity` 를 채우는 운영 경로가 없어
 *    고쳐도 Production 이 안 바뀌었다. **이 수정은 다르다** —
 *    `productFactsFromShopifyProduct` 의 Production 소비자가 둘이다:
 *
 *      product-url-facts.ts:162   Light Fetch → candidate.facts
 *      shopify-suggest.ts:69      registry OVERSEAS 11 도메인이 «공유» 한다
 *
 * 🔴 그러나 「소비자가 있다」는 「판정이 바뀐다」가 아니다. 그래서 실제 판정
 *    함수(`compareCrossSellerProducts`)를 통과시켜 **brand 축이 실제로 달라지는지**
 *    를 측정한다.
 *
 * 🟢 측정 재료가 실측 fixture 에 이미 있다 — **같은 상품이 두 판매처에 있다**:
 *      junioredition-bubble-sweatshirt-in-grey-melange-by-main-story.json  (편집샵)
 *      main-story-bubble-sweatshirt-grey-melange-1.json                    (자사몰)
 *    vendor 가 각각 'Main Story AW26' · 'Main Story' 다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "../cross-seller";
import { brandFromTitleByClause, productFactsFromShopifyProduct } from "../seller-facts";
import type { ProductFacts } from "@commerce/shared";

const FIXTURES = path.join(__dirname, "..", "..", "__tests__", "fixtures");

function factsOf(file: string, domain: string): ProductFacts {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, file), "utf8")) as Record<string, unknown>;
  return productFactsFromShopifyProduct(
    {
      title: raw.title as string,
      handle: raw.handle as string,
      url: `/products/${raw.handle as string}`,
      description: raw.description as string,
      vendor: raw.vendor as string,
      type: raw.type as string,
      tags: raw.tags as string[],
      options: raw.options as { name?: string; values?: string[] }[],
      images: raw.images as string[],
    },
    domain,
  );
}

const JE = "junioredition-bubble-sweatshirt-in-grey-melange-by-main-story.json";
const MS = "main-story-bubble-sweatshirt-grey-melange-1.json";

describe("🔴 MI-P0-02l STEP 7 — Production 판정 경로 확인", () => {
  it("🟢 같은 상품의 두 판매처 brand 가 이제 «일치» 한다", () => {
    const je = factsOf(JE, "junioredition.com");
    const ms = factsOf(MS, "main-story.com");
    // 🔴 수정 전: je.brand = 'Main Story AW26' · ms.brand = 'Main Story' → 불일치
    expect(je.brand).toBe("Main Story");
    expect(ms.brand).toBe("Main Story");
    expect(je.brand).toBe(ms.brand);
  });

  /**
   * 🔴 **대조군 — 수정이 없었다면 어땠는가.** 같은 입력에서 by절 규칙만 끄고
   *    옛 우선순위를 재현해, 수정 전 값이 실제로 달랐다는 것을 고정한다.
   *    이 단언이 깨지면 「수정할 필요가 없었다」는 뜻이다.
   */
  it("🔴 수정이 없었다면 두 brand 가 달랐다 — 그래서 필요한 수정이었다", () => {
    const raw = JSON.parse(readFileSync(path.join(FIXTURES, JE), "utf8")) as Record<string, unknown>;
    const vendor = (raw.vendor as string).trim();
    const title = raw.title as string;
    // 옛 동작 = vendor 를 그대로 쓴다(시즌코드 «전체» 가 아니므로 가드가 통과시켰다)
    expect(vendor).toBe("Main Story AW26");
    expect(vendor).not.toBe("Main Story");
    // 새 규칙이 그 오염을 걷어낸다
    expect(brandFromTitleByClause(title, vendor)).toBe("Main Story");
  });

  /**
   * 🔴🔴 **최종 판정 경로.** brand 는 `compareCrossSellerProducts` 의 입력이고
   *    그 결과가 `crossSellerVerdict` → `deriveMatchTruth` → `matchTruth` 로 간다.
   *    여기서 brand 축이 «반증을 만들지 않는지» 를 본다.
   */
  it("🟢 교차판매처 판정이 brand 를 이유로 반증하지 않는다", () => {
    const je = factsOf(JE, "junioredition.com");
    const ms = factsOf(MS, "main-story.com");
    const verdict = compareCrossSellerProducts(je, ms);
    const conflicts = (verdict.conflicts ?? []).map((c) => String(c.conflict ?? c));
    // 🔴 brand 가 어긋나면 BRAND_MISMATCH 가 나온다. 그것이 없어야 한다.
    expect(conflicts.join(","), `conflicts=${conflicts.join(",")}`).not.toContain("BRAND");
  });

  /**
   * 🔴 **회귀 대조군.** 자사몰(by절 0%)은 경로가 바뀌지 않았다는 것을 고정한다.
   *    bobochoses 는 ①이 발화하지 않고 ③(도메인 매핑)이 그대로 담당한다.
   */
  it("🟢 자사몰 경로는 바뀌지 않았다 — 추가 전용임을 고정한다", () => {
    const bobo = factsOf("bobochoses-b226ac114.json", "bobochoses.com");
    expect(bobo.brand).toBe("Bobo Choses");
    // by절이 없으므로 ①은 null 이었고 ③이 값을 만들었다.
    const raw = JSON.parse(readFileSync(path.join(FIXTURES, "bobochoses-b226ac114.json"), "utf8")) as Record<string, unknown>;
    expect(brandFromTitleByClause(raw.title as string, (raw.vendor as string).trim())).toBeNull();
  });
});
