import { afterEach, describe, expect, it, vi } from "vitest";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { LISTING_EXECUTORS } from "../registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-3C(CPO 결정, 2026-09-26) — **네트워크 오류에 가짜 payload 를 싣지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 문제였나 ───────────────────────────────────────────────────────
 * smartstore 는 두 개의 payload 빌더를 갖고 있다:
 *
 *     smartstore/build-payload.ts   DRY_RUN 전용. 스스로 「실제 스키마가 아니다」
 *     naver/build-payload.ts        실제로 네이버에 나가는 것(서버가 만든다)
 *
 * 그리고 프로덕션 mode 는 **항상 LIVE** 다(CommerceWorkspace resolveExecutionMode —
 * smartstore 는 무조건 "LIVE"). 그래서 앞쪽 빌더의 결과가 셀러에게 닿는 경로는
 * 딱 하나였다: `fetch` 가 던졌을 때의 실패 결과에 `payload` 로 실리는 것.
 *
 * 🔴 그 화면에서 셀러가 읽는 것은 「보낼 적이 없는 payload」다. 서버가 무엇을
 * 만들었는지 이 자리에서는 우리가 «모른다» — 모르는 것은 비워 둔다.
 *
 * ── 🔴 이 테스트가 «막지 않는» 것 ────────────────────────────────────────
 * 두 빌더를 하나로 합치는 것은 이번 범위가 아니다(CPO: 대규모 통합 금지).
 * 여기서 고정하는 것은 「실패 결과가 가짜를 들고 오지 않는다」 하나뿐이고,
 * PREVIEW/DRY_RUN 이 payload 를 그대로 내는 것은 **회귀로 함께 고정한다** —
 * 안전을 이유로 미리보기를 조용히 없애면 그것도 같은 종류의 사고다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** contract.test.ts 의 픽스처와 같은 모양 — 여기서 새 상품 모델을 만들지 않는다. */
function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 10000, currency: "KRW" }),
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
    images: [
      {
        id: "img-1",
        originalUrl: "https://example.com/images/test.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
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
  };
}

/**
 * 🔴 실제 어댑터가 만든 ListingModel 을 쓴다 — 손으로 흉내 낸 객체는 필드가 하나
 * 늘 때마다 깨지면서 진짜 모델과 달라진다(이 저장소가 두 번 겪은 실패다).
 *
 * `validations` 만 비운다. `validateSmartStoreListing` 은 그 배열을 그대로 옮기므로
 * (errorCount = ERROR 개수) 비우면 등록 직전 가드를 통과해 네트워크 경로까지 간다.
 * 🔴 가드 자체를 바꾸는 것이 아니라, 이 테스트가 «그 뒤» 를 보려는 것이다.
 */
function passingListing(product: CanonicalProduct): ListingModel {
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(
    product,
    UNRESOLVED_CATEGORY,
    undefined,
    "smartstore",
  );
  return { ...listing, validations: [] };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("🔴 LIVE 네트워크 오류 — 실패 결과가 가짜 payload 를 들고 오지 않는다", () => {
  it("fetch 가 던지면 payload 키 자체가 없다", async () => {
    const product = makeProduct();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("socket hang up"))),
    );

    const result = await LISTING_EXECUTORS.smartstore.execute(product, passingListing(product), "LIVE");

    expect(result.status).toBe("FAILED");
    expect(result.error?.step).toBe("NETWORK");
    expect(result.error?.message).toContain("socket hang up");
    /* 🔴 `payload: undefined` 도 아니고 «키가 없다». 화면이 `payload` 유무로
       블록을 그리므로, undefined 라도 담아 두면 다음 사람이 되살리기 쉽다. */
    expect("payload" in result, "실패 결과에 payload 가 실려 있다 — 보낼 적이 없는 값이다").toBe(false);
  });

  it("🔴 LIVE 는 실제 서버 라우트를 부른다 — 실패해도 경로가 바뀌지 않는다", async () => {
    const product = makeProduct();
    /* 🔴 인자를 «선언해» 둔다. 인자 없는 vi.fn 은 calls 가 빈 튜플로 추론돼
       `calls[0][0]` 이 타입 오류가 된다(실제로 그렇게 한 번 틀렸다). */
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.reject(new Error("boom")),
    );
    vi.stubGlobal("fetch", fetchMock);

    await LISTING_EXECUTORS.smartstore.execute(product, passingListing(product), "LIVE");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/smartstore/register");
  });

  it("성공 응답은 서버가 준 결과를 그대로 돌려준다(가짜로 덮지 않는다)", async () => {
    const product = makeProduct();
    const served = {
      status: "SUBMITTED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: false,
      payload: { originProduct: { name: "서버가 만든 것" } },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve(served) } as Response)),
    );

    const result = await LISTING_EXECUTORS.smartstore.execute(product, passingListing(product), "LIVE");

    expect(result).toEqual(served);
  });
});

describe("🔴 회귀 — 바꾸지 않은 것들", () => {
  it("PREVIEW 는 여전히 payload 를 낸다(미리보기를 조용히 없애지 않았다)", async () => {
    const product = makeProduct();
    const result = await LISTING_EXECUTORS.smartstore.execute(product, passingListing(product), "PREVIEW");
    expect(result.status).toBe("READY");
    expect(result.payload).toBeDefined();
  });

  it("DRY_RUN 도 여전히 payload 를 낸다", async () => {
    const product = makeProduct();
    const result = await LISTING_EXECUTORS.smartstore.execute(product, passingListing(product), "DRY_RUN");
    expect(result.status).toBe("SUBMITTED");
    expect(result.payload).toBeDefined();
  });

  it("🔴 검증 ERROR 는 여전히 네트워크 «앞» 에서 막는다 — 호출 0회", async () => {
    const product = makeProduct();
    const fetchMock = vi.fn(() => Promise.reject(new Error("불려서는 안 된다")));
    vi.stubGlobal("fetch", fetchMock);

    /* ══════════════════════════════════════════════════════════════════════
       🔴 처음에 「UNRESOLVED_CATEGORY 면 카테고리가 ERROR 다」라고 적었다가 이
       단정에 걸렸다 — 실제로는 ERROR 가 «하나도» 나오지 않는다(어댑터가 미확정
       카테고리를 ERROR 로 내지 않는다). 그 가정을 지우고, 이 테스트가 실제로
       보려는 것만 만든다: `errorCount > 0` 이면 네트워크 앞에서 막히는가.

       🔴 상태만 바꾼다 — 검증 항목의 «모양» 은 어댑터가 만든 실물 그대로다. */
    const base = PLATFORM_ADAPTERS.smartstore.toListingModel(
      product,
      UNRESOLVED_CATEGORY,
      undefined,
      "smartstore",
    );
    expect(base.validations.length, "어댑터가 검증 항목을 하나도 내지 않는다").toBeGreaterThan(0);
    const listing: ListingModel = {
      ...base,
      validations: [{ ...base.validations[0]!, status: "ERROR" }, ...base.validations.slice(1)],
    };

    const result = await LISTING_EXECUTORS.smartstore.execute(product, listing, "LIVE");

    expect(result.status).toBe("FAILED");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
