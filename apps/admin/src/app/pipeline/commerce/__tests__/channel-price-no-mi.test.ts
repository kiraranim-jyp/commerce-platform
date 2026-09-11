import { afterEach, describe, expect, it, vi } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { applyChannelPriceOverride, clearChannelPriceOverride } from "@commerce/marketplace";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { buildChannelPriceAuditRecord, buildPriceBreakdownSnapshot } from "@/lib/channel-price-audit";

/**
 * PHASE 3.2(CPO 확정, 2026-09-11) ⑧⑩.
 *
 * ⑧ 채널 가격을 바꿔도 MI(시장 판단)는 다시 돌지 않는다 — 누락이 아니라 의도다.
 *    MI는 "이 상품을 팔 만한가"를, 채널 최종가는 "이 채널에 얼마로 등록할
 *    것인가"를 답한다. 두 질문을 배선으로 연결하면 셀러가 쿠팡 가격을 10원
 *    고칠 때마다 시장 재조회가 돌고, 그 응답이 판단 카드를 갈아치운다.
 *
 *    이 테스트가 증명하는 두 가지:
 *      (a) 채널 가격 변경 경로가 네트워크를 전혀 건드리지 않는다(fetch 0회).
 *      (b) MI가 읽는 입력(price / priceOverrideKrw / priceBreakdown —
 *          api/price-history/_lib/market-intelligence.ts가 실제로 읽는 필드)이
 *          한 글자도 바뀌지 않는다. 재판정할 근거 자체가 생기지 않는다는 뜻이다.
 *    화면 쪽 발동 조건도 같은 결론이다: MI 조회는 snapshotId를 키로만 일어난다
 *    (pipeline/page.tsx의 최초 스냅샷 생성 1회, DomesticPriceIntelligencePanel의
 *    useEffect([snapshotId]), 셀러가 직접 누르는 [가격 다시 확인]).
 *
 * ⑩ 과거 registration_attempts.price_breakdown의 의미는 불변이다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

const PRODUCT_FINAL_KRW = 143500;

function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 88, currency: "GBP" }),
    priceValidity: "VALID",
    sku: field("TEST-SKU-1"),
    description: field("A test product."),
    material: field(""),
    color: field(""),
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
    countryOfOrigin: field("대한민국"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(999, "DEFAULT"),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(PRODUCT_FINAL_KRW, "USER_EDITED"),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PHASE 3.2 ⑧: 채널 가격을 바꿔도 MI API를 부르지 않는다", () => {
  it("⑧-a: 채널 가격 지정/삭제 경로에서 fetch가 한 번도 호출되지 않는다", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const withCoupang = applyChannelPriceOverride(makeProduct(), "coupang", 145000);
    const withBoth = applyChannelPriceOverride(withCoupang, "smartstore", 139000);
    clearChannelPriceOverride(withBoth, "coupang");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("⑧-b: MI가 읽는 입력(price/priceOverrideKrw/priceBreakdown)이 전혀 바뀌지 않는다 — 재판정할 근거가 없다", () => {
    const before = makeProduct();
    const after = clearChannelPriceOverride(
      applyChannelPriceOverride(applyChannelPriceOverride(before, "coupang", 145000), "smartstore", 139000),
      "smartstore",
    );

    expect(after.price).toEqual(before.price);
    expect(after.priceOverrideKrw).toEqual(before.priceOverrideKrw);
    expect(after.priceBreakdown).toEqual(before.priceBreakdown);
    expect(after.priceValidity).toBe(before.priceValidity);
    // 관세/부가세 등 마진 계산에 들어가는 나머지 입력도 그대로다.
    expect(after.customsDutyKrw).toEqual(before.customsDutyKrw);
    expect(after.customsVatKrw).toEqual(before.customsVatKrw);

    // 달라진 것은 정확히 채널 최종가 하나뿐이어야 한다.
    const changedKeys = (Object.keys(after) as (keyof CanonicalProduct)[]).filter(
      (k) => after[k] !== before[k],
    );
    expect(changedKeys).toEqual(["channelPriceOverrides"]);
  });
});

describe("PHASE 3.2 ⑩: registration_attempts.price_breakdown의 의미는 바뀌지 않는다", () => {
  it("⑩: 채널 최종가를 지정해도 price_breakdown.salePriceKrw는 여전히 상품정보의 최종 판매가격이다", () => {
    const base = makeProduct();
    const withChannelPrice = applyChannelPriceOverride(base, "coupang", 145000);

    const before = buildPriceBreakdownSnapshot(base);
    const after = buildPriceBreakdownSnapshot(withChannelPrice);

    // 같은 상품 가격 계산 결과 → 완전히 같은 스냅샷. 채널 값은 여기 새지 않는다.
    expect(after).toEqual(before);
    expect(after?.salePriceKrw).toBe(PRODUCT_FINAL_KRW);
    expect(after?.salePriceKrw).not.toBe(145000);
    // 계산 입력(원본가/통화/배송비/수수료율/마진율)도 그대로 — 이 컬럼의 뜻은
    // "당시 상품 가격 계산 결과"이지 "채널에 나간 가격"이 아니다.
    expect(after?.originalAmount).toBe(base.price.value.amount);
    expect(after?.originalCurrency).toBe(base.price.value.currency);
    expect(after?.feePercent).toBe(base.priceBreakdown?.feePercent);
  });

  it("⑩-부가: 채널 최종가는 별도 기록(channel_price_record)에만 들어간다 — 두 기록이 서로 다른 사실을 말한다", () => {
    const record = buildChannelPriceAuditRecord(
      {
        platform: "coupang",
        platformLabel: "쿠팡",
        additionalImages: [],
        title: "Test Item",
        priceKrw: 145000,
        priceIsEstimate: false,
        priceSource: "SELLER_OVERRIDE",
        priceOrigin: "CHANNEL_OVERRIDE",
        options: [],
        shippingInfo: "해외배송",
        description: "",
        category: UNRESOLVED_CATEGORY,
        validations: [],
        registrableScore: 0,
      },
      "2026-09-11T00:00:00.000Z",
    );

    expect(record).toEqual({
      platform: "coupang",
      finalPriceKrw: 145000,
      priceOrigin: "CHANNEL_OVERRIDE",
      priceOriginLabel: "채널 최종 등록가격",
      registeredAt: "2026-09-11T00:00:00.000Z",
    });
  });
});
