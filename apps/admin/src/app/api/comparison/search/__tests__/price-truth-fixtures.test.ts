import { describe, expect, it } from "vitest";
import {
  stripShopifyLocalePrefix,
  withConfidence,
  type ComparisonCandidate,
  type ComparisonQuery,
  type ComparisonSearchResult,
  type SourcePriceVerification,
} from "@commerce/crawler";

/**
 * P-4-DATA-7(CPO 지시, 2026-08-29) — P-4-DATA-4~6 전 과정에서 실측 확인된 7개
 * 실제 사고/케이스를 PT-01~PT-07로 고정한다. CPO 지적사항 반영: Booty Ghosts는
 * "Long Sleeve"(£37, PT-01)와 "T-Shirt"(£35, PT-02)가 서로 다른 SKU다 —
 * 이전 보고서에서 이 둘을 섞어 썼던 것을 여기서는 명확히 분리한다.
 *
 * PT-07은 이번 P-4-DATA-6 수정(로케일 프리픽스 제거)의 핵심 회귀 가드다.
 */

function candidate(overrides: Partial<ComparisonCandidate>): ComparisonCandidate {
  return {
    title: "",
    url: "https://example.com/products/x",
    price: null,
    imageUrl: null,
    confidence: 0,
    priceStatus: "UNVERIFIED_SEARCH",
    verificationAttempted: false,
    ...overrides,
  };
}

describe("PT-01 — Booty Ghosts Long Sleeve T-Shirt (원본 조회 상품, £37, VERIFIED_CURRENT)", () => {
  it("실측(2026-08-29 프로덕션 API): priceSource=detail → VERIFIED_CURRENT, £37 GBP", () => {
    const query: ComparisonQuery = { title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses", brand: "Bobo Choses" };
    const candidates = [
      candidate({
        title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses",
        price: { amount: 37, currency: "GBP" },
        priceSource: "detail",
      }),
    ];
    const [scored] = withConfidence(query, candidates);
    expect(scored.matchLevel).toBe("very_high");
    expect(scored.priceStatus).toBe("VERIFIED_CURRENT");
    expect(scored.price).toEqual({ amount: 37, currency: "GBP" });
  });
});

describe("PT-02 — Booty Ghosts T-Shirt(반팔, PT-01과 다른 SKU, £35, 유사상품)", () => {
  it("실측(2026-08-29): Long Sleeve를 쿼리로 검색 시 75% 유사상품으로 나오고, 검증되면 £35 GBP", () => {
    const query: ComparisonQuery = { title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses", brand: "Bobo Choses" };
    const candidates = [
      candidate({
        title: "Booty Ghosts T-Shirt by Bobo Choses",
        price: { amount: 35, currency: "GBP" },
        priceSource: "detail",
      }),
    ];
    const [scored] = withConfidence(query, candidates);
    // PT-01(£37)과 다른 상품이라는 걸 title/price 둘 다로 증명 — 같은 fixture로 섞이면 안 된다.
    expect(scored.title).not.toBe("Booty Ghosts Long Sleeve T-Shirt by Bobo Choses");
    expect(scored.price).toEqual({ amount: 35, currency: "GBP" });
    expect(scored.priceStatus).toBe("VERIFIED_CURRENT");
  });
});

describe("PT-03 — Misha & Puff Mink Cardigan(76% 매칭, 검색 인덱스 원값 £270, 실가격 £159)", () => {
  it("검증 전(priceSource 없음)에는 검색 인덱스의 £270이 있어도 UNVERIFIED_SEARCH로 시작 — 숫자 노출 금지", () => {
    const query: ComparisonQuery = { title: "Baby Circus Stripe Cardigan in Antique Rose by Misha & Puff" };
    const candidates = [
      candidate({
        title: "...in Mink by Misha & Puff",
        price: { amount: 270, currency: "GBP" }, // 검색 인덱스가 반환한 원값(실측 오염 사례) — 신뢰 안 함
        matchLevel: "medium",
      }),
    ];
    const [scored] = withConfidence(query, candidates);
    expect(scored.priceStatus).toBe("UNVERIFIED_SEARCH");
    // priceStatus가 VERIFIED_CURRENT가 아니므로 price 필드에 270이 남아있어도
    // UI(PriceCell/isPriceDisplayable)는 이 값을 절대 화면에 보여주지 않는다.
  });
});

describe("PT-04 — Hug Hairy Monster(100% 매칭, 상세검증 시도했으나 실패)", () => {
  it("very_high 매칭이어도 검증 실패(catch) 시 PRICE_UNAVAILABLE — matchLevel과 무관하게 숫자 비노출", () => {
    // P-4-DATA-4 이전에는 이 케이스에서 catch{}가 조용히 검색값을 그대로 남겼다(사고).
    // 지금은 enrichCandidatePrices의 catch 분기가 명시적으로 PRICE_UNAVAILABLE을 셋팅한다.
    const failedVerification = candidate({
      title: "Hug Hairy Monster Sweatshirt",
      matchLevel: "very_high",
      confidence: 1,
      price: { amount: 62, currency: "GBP" }, // 검색 시점 값(참고용, 화면 노출 대상 아님)
      priceStatus: "PRICE_UNAVAILABLE",
      verificationAttempted: true,
    });
    expect(failedVerification.matchLevel).toBe("very_high");
    expect(failedVerification.priceStatus).toBe("PRICE_UNAVAILABLE");
    expect(failedVerification.verificationAttempted).toBe(true);
  });
});

describe("PT-05 — Voyage Dress(세일 판매가 £51.20 / 정가 £128, VERIFIED_CURRENT)", () => {
  it("regularPrice > price일 때만 세일 표시 대상 — 둘 다 상세 검증된 값이어야 한다", () => {
    const query: ComparisonQuery = { title: "Voyage Dress" };
    const candidates = [
      candidate({
        title: "Voyage Dress",
        price: { amount: 51.2, currency: "GBP" },
        regularPrice: { amount: 128, currency: "GBP" },
        priceSource: "detail",
      }),
    ];
    const [scored] = withConfidence(query, candidates);
    expect(scored.priceStatus).toBe("VERIFIED_CURRENT");
    expect(scored.regularPrice?.amount).toBeGreaterThan(scored.price!.amount);
  });
});

describe("PT-06 — Stamp Bloom Denim Pants(검색 인덱스 0건, F3) — 검색결과 없음과 sourceVerification은 독립 경로", () => {
  it("candidates가 0건이어도 sourceVerification(원본 URL 직접 재조회)은 별도로 VERIFIED_CURRENT일 수 있다", () => {
    // 실측: search/suggest.json이 이 상품을 못 찾았지만(F3), sourceUrl 직접 재조회
    // (verifySourcePriceDirect, P-4-DATA-4 STEP4)는 검색 인덱스와 무관한 경로라 성공했다.
    // 이 둘을 하나의 상태로 합치는 코드가 생기면(예: "검색 0건 → sourceVerification도 없다고
    // 가정") 이 테스트가 그 가정이 틀렸다는 걸 보여준다.
    const emptySearchResult: ComparisonSearchResult = {
      shopId: "junior-edition",
      shopName: "Junior Edition",
      domain: "junioredition.com",
      status: "ok",
      candidates: [],
    };
    const sourceVerification: SourcePriceVerification = {
      status: "VERIFIED_CURRENT",
      price: { amount: 90, currency: "GBP" },
      regularPrice: null,
    };
    expect(emptySearchResult.candidates).toHaveLength(0);
    expect(sourceVerification.status).toBe("VERIFIED_CURRENT");
  });
});

describe("PT-07 — locale sourceUrl(/en-kr/ 등)이어도 항상 원본 통화(GBP) 가격을 반환 (P-4-DATA-6 P0-2 핵심 회귀 가드)", () => {
  it("실제 저장된 sourceUrl 형태(/en-kr/products/handle)에서 로케일을 벗기면 원본 매장 URL이 된다", () => {
    // 실측(2026-08-29): 이 URL로 fetchShopifyProductJson을 그대로 호출하면 Shopify
    // Markets가 KRW로 자체 환산한 값이 돌아왔다(F5). stripShopifyLocalePrefix를 거친
    // URL로만 조회해야 원본 GBP가 나온다 — verifySourcePriceDirect/enrichCandidatePrices
    // 둘 다 반드시 이 함수를 거치도록 코드가 짜여 있다(packages/crawler/src/
    // comparison-search/index.ts 참고).
    const withLocale = "https://www.junioredition.com/en-kr/products/booty-ghosts-t-shirt-by-bobo-choses";
    expect(stripShopifyLocalePrefix(withLocale)).toBe(
      "https://www.junioredition.com/products/booty-ghosts-t-shirt-by-bobo-choses",
    );
  });

  it("로케일 프리픽스가 이미 없는 URL은 그대로 유지된다", () => {
    const noLocale = "https://www.junioredition.com/products/booty-ghosts-t-shirt-by-bobo-choses";
    expect(stripShopifyLocalePrefix(noLocale)).toBe(noLocale);
  });

  it("컬렉션 경유 링크(/en-kr/collections/x/products/handle)에서도 로케일 세그먼트만 벗긴다 — 컬렉션 경로는 보존", () => {
    const collectionPath = "https://www.junioredition.com/en-kr/collections/pepe-shoes/products/handle";
    expect(stripShopifyLocalePrefix(collectionPath)).toBe(
      "https://www.junioredition.com/collections/pepe-shoes/products/handle",
    );
  });

  it("쿼리스트링(검색 결과 트래킹 파라미터 등)은 그대로 보존한다", () => {
    const withQuery = "https://www.junioredition.com/en-us/products/handle?_pos=1&_psq=x";
    expect(stripShopifyLocalePrefix(withQuery)).toBe("https://www.junioredition.com/products/handle?_pos=1&_psq=x");
  });

  it("다른 로케일 코드(en-us, ko-kr 등)도 동일하게 벗긴다 — /en-kr/ 하나만 특별취급하지 않는다", () => {
    expect(stripShopifyLocalePrefix("https://www.junioredition.com/ko-kr/products/x")).toBe(
      "https://www.junioredition.com/products/x",
    );
  });
});
