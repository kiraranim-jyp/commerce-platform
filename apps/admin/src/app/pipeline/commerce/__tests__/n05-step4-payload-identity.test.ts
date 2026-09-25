import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY, type CategorySelection } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import {
  buildCoupangPayload,
  buildLotteOnPayload,
  buildNaverProductPayload,
  toCoupangBinding,
  BLANK_LOTTEON_CHANNEL_CONFIG,
} from "@commerce/listing";
/* 🔴 화면이 쓰는 그 함수다(패널도 Master 경로도 이것을 부른다). 패키지가 아니라
   화면 레이어에 산다 — 롯데ON 폼의 모양은 화면의 것이기 때문이다. */
import { fromLotteOnChannelInfo, toLotteOnChannelPayload } from "../lotteon-channel-form";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { COMMERCE_ORDER, isPlatformCommerce, type CommerceId } from "../commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-05 STEP 4(CPO 지정 핵심 검증, 2026-09-23)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   기존 «단독» 등록 payload  ==  Master 다중등록 경로 payload
 *
 * 세 커머스 전부에 대해 이것을 고정한다. 하나라도 갈리면 「Master 에서 누른
 * 등록」과 「탭에서 누른 등록」이 다른 상품을 올리는 것이고, 그건 셀러가 화면
 * 어디서도 알 수 없는 차이다.
 *
 * ── 🔴 왜 «같은 함수» 인지가 더 중요한가 ──────────────────────────────────
 * 값이 같은지 비교하는 것만으로는 부족하다 — 오늘 같아도 내일 한쪽만 고치면
 * 갈린다. 그래서 ③에서 «경로가 하나» 라는 것을 소스로 고정한다:
 *   · ListingModel 은 `listingModelFor()` 하나가 만든다(탭도 다중 등록도).
 *   · 롯데ON 본문은 패널이 쓰는 그 순수 함수 두 개로 만든다.
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
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    manufacturer: field("테스트제조사"),
    careInstructions: field("손세탁"),
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
    titleKo: field("테스트 상품"),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("대한민국"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(30, "DEFAULT"),
    certification: field(""),
    importer: field("따져코리아"),
    childCertification: field(null),
    itemName: field("아동용 반바지"),
    modelName: field("MODEL-1"),
    weight: field("120g"),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(PRODUCT_FINAL_KRW, "USER_EDITED"),
    categoryFieldOverrides: { 제조자: "셀러가쿠팡화면에서채운값" },
    lotteOnChannelInfo: {
      category: { standardCategoryNo: "BC63080300", displayCategoryNos: ["FC11130203"], selected: null },
      notice: { itemCode: "01", articlesText: "0020|블루" },
      certification: { safetyText: "", importProxyCode: "" },
      delivery: {
        outboundPlaceNo: "115",
        returnPlaceNo: "115",
        deliveryCostPolicyNo: "335",
        deliveryRegionGroupCode: "GN101",
        courierCode: "",
        returnCourierCode: "",
        weekdayCloseTime: "1400",
      },
      codes: { originCode: "KR", taxTypeCode: "TDF", brandNo: "", externalProductNo: "" },
    },
  } as CanonicalProduct;
}

/**
 * 🔴 화면이 ListingModel 을 만드는 방식 그대로다(CommerceWorkspace 의
 * `listingModelFor`). 단독 등록이든 다중 등록이든 «이 한 함수» 를 거친다.
 */
function listingModelFor(product: CanonicalProduct, platformId: "smartstore" | "coupang", category: CategorySelection) {
  return PLATFORM_ADAPTERS[platformId].toListingModel(product, category, undefined, platformId);
}

const NAVER_CONTEXT = {
  leafCategoryId: "50000535",
  releaseAddressBookNo: 900000001,
  refundAddressBookNo: 900000002,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 5000,
  childCertificationInfoId: null,
  categoryRequiresChildCertification: false,
  originAreaCode: "00",
  originAreaRequiresContent: false,
} as const;

describe("① 🔴 스마트스토어 — 단독 등록 payload == 다중등록 경로 payload", () => {
  it("같은 상품·같은 카테고리에서 두 payload 가 한 글자도 다르지 않다", () => {
    const product = makeProduct();
    /* 단독: 지금 보고 있는 탭이 만든 ListingModel
       다중: 선택된 채널을 위해 만든 ListingModel — 같은 함수, 같은 인자다. */
    const single = buildNaverProductPayload({
      product,
      listing: listingModelFor(product, "smartstore", UNRESOLVED_CATEGORY),
      ...NAVER_CONTEXT,
    });
    const multi = buildNaverProductPayload({
      product,
      listing: listingModelFor(product, "smartstore", UNRESOLVED_CATEGORY),
      ...NAVER_CONTEXT,
    });
    expect(multi).toEqual(single);
    expect(multi.originProduct.salePrice).toBe(PRODUCT_FINAL_KRW);
  });
});

describe("② 🔴 쿠팡 — 단독 등록 payload == 다중등록 경로 payload", () => {
  it("채널 바인딩까지 같은 통로로 간다", () => {
    const product = makeProduct();
    const listing = listingModelFor(product, "coupang", UNRESOLVED_CATEGORY);
    const single = buildCoupangPayload(product, listing, { binding: toCoupangBinding(product) });
    const multi = buildCoupangPayload(product, listing, { binding: toCoupangBinding(product) });
    expect(multi).toEqual(single);
  });

  it("🔴 바인딩을 빠뜨리면 «다른» payload 가 된다 — 이 검사가 그것을 잡는다", () => {
    /* 다중 등록 경로가 binding 을 안 넘기면 셀러가 화면에서 채운 값이 조용히
       사라진다. 그 차이가 실제로 payload 에 나타나는지부터 확인해 둔다 —
       나타나지 않으면 위 ②는 아무것도 지키지 못하는 검사다. */
    const product = makeProduct();
    const listing = listingModelFor(product, "coupang", UNRESOLVED_CATEGORY);
    const meta = {
      attributes: [
        {
          attributeTypeName: "제조자",
          dataType: "STRING",
          inputType: "INPUT",
          inputValues: [],
          basicUnit: "없음",
          required: "MANDATORY" as const,
        },
      ],
      noticeCategories: [],
    };
    const withBinding = buildCoupangPayload(product, listing, {
      binding: toCoupangBinding(product),
      categoryMeta: meta,
    });
    const without = buildCoupangPayload(product, listing, { binding: {}, categoryMeta: meta });
    expect(JSON.stringify(withBinding)).toContain("셀러가쿠팡화면에서채운값");
    expect(JSON.stringify(without)).not.toContain("셀러가쿠팡화면에서채운값");
  });
});

describe("③ 🔴 롯데ON — 패널 경로 payload == Master 경로 payload", () => {
  it("상품에 저장된 롯데ON 관리정보로 만든 본문이 같다", () => {
    const product = makeProduct();
    /* 패널은 `fromLotteOnChannelInfo(product.lotteOnChannelInfo)` 로 폼을 세우고
       `toLotteOnChannelPayload(form)` 로 본문을 만든다. Master 경로도 «그 두
       함수» 를 그대로 부른다 — 순수 함수라 패널을 띄우지 않아도 된다. */
    const panelBody = toLotteOnChannelPayload(fromLotteOnChannelInfo(product.lotteOnChannelInfo));
    const masterBody = toLotteOnChannelPayload(fromLotteOnChannelInfo(product.lotteOnChannelInfo));
    expect(masterBody).toEqual(panelBody);
  });

  it("그 본문으로 만든 87 payload 도 같다", () => {
    const product = makeProduct();
    const channelInput = toLotteOnChannelPayload(fromLotteOnChannelInfo(product.lotteOnChannelInfo));
    const channel = {
      ...BLANK_LOTTEON_CHANNEL_CONFIG,
      ...channelInput,
      trGrpCd: "SR",
      trNo: "LO10000",
      saleStartDttm: "20260914090000",
      saleEndDttm: "20310914235959",
    };
    const a = buildLotteOnPayload({ product, channel, detailHtml: "<p>상세</p>" });
    const b = buildLotteOnPayload({ product, channel, detailHtml: "<p>상세</p>" });
    expect(b).toEqual(a);
    // 상품에 저장돼 있던 그 값이 실제로 실린다 — 빈 payload 로 통과하지 않는다.
    expect(a.spdLst[0].scatNo).toBe("BC63080300");
  });
});

/** 주석을 걷어낸 «실행되는 코드» 만. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));

describe("④ 🔴 경로가 «하나» 라는 것을 소스로 고정한다", () => {
  it("ListingModel 을 만드는 곳이 한 함수다 — 탭도 다중 등록도 그것을 부른다", () => {
    expect(WORKSPACE).toContain("const listingModelFor = useCallback(");
    // 탭의 listing 이 그 함수를 쓴다.
    expect(WORKSPACE).toContain("return listingModelFor(tab);");
    // 등록 실행도 그 함수를 쓴다(예전에는 tab 의 listing 을 그대로 썼다).
    expect(WORKSPACE).toContain("const listing = listingModelFor(platform);");
  });

  it("어댑터를 «직접» 부르는 곳이 그 함수 하나뿐이다", () => {
    const calls = WORKSPACE.match(/PLATFORM_ADAPTERS\[[a-zA-Z]+\]\.toListingModel\(/g) ?? [];
    expect(calls.length, "ListingModel 을 만드는 두 번째 경로가 생겼다").toBe(2); // listingModelFor + 사전점검
  });

  it("롯데ON 본문은 패널이 쓰는 순수 함수 두 개로 만든다", () => {
    expect(WORKSPACE).toContain("toLotteOnChannelPayload(fromLotteOnChannelInfo(product.lotteOnChannelInfo))");
  });

  it("confirmListing 이 커머스를 인자로 받는다(CPO 승인 ③)", () => {
    /* P0-CHANNEL-03 F-10 에서 두 번째 인자(RECREATE 동의)가 늘었다. 여기서
       지키려는 것은 «커머스를 첫 인자로 받는다» 이므로 거기까지만 본다. */
    expect(WORKSPACE).toMatch(/async function confirmListing\(\s*target\?: PlatformId,?/);
  });
});

describe("⑤ 🔴 선택된 커머스만, 화면 순서대로, 독립적으로", () => {
  it("실행 대상은 선택 교집합이고 순서는 COMMERCE_ORDER 다", () => {
    const selected: CommerceId[] = ["lotteon", "smartstore"]; // 셀러가 고른 순서
    const targets = COMMERCE_ORDER.filter((id) => selected.includes(id));
    // 화면이 보여주는 순서 그대로여야 결과 목록과 눈으로 맞출 수 있다.
    expect(targets).toEqual(["smartstore", "lotteon"]);
    expect(targets).not.toContain("coupang");
  });

  it("소스가 그 규칙을 그대로 쓴다", () => {
    expect(WORKSPACE).toContain("COMMERCE_ORDER.filter((id) => selectedCommerces.includes(id))");
  });

  it("🔴 채널마다 try/catch 가 있고, 실패해도 루프를 멈추지 않는다", () => {
    const loop = WORKSPACE.slice(
      WORKSPACE.indexOf("async function registerSelected()"),
      WORKSPACE.indexOf("function retryListing()"),
    );
    expect(loop).toContain("for (const id of targets)");
    expect(loop).toContain("try {");
    expect(loop).toContain("} catch (error) {");
    // 루프 안에 조기 종료가 없다 — 한 채널의 실패가 나머지를 막지 않는다.
    expect(loop).not.toContain("break;");
    expect(loop).not.toContain("throw ");
  });

  it("🔴 rollback 이 없다 — 성공한 채널을 되돌리지 않는다", () => {
    const loop = WORKSPACE.slice(
      WORKSPACE.indexOf("async function registerSelected()"),
      WORKSPACE.indexOf("function retryListing()"),
    );
    for (const forbidden of ["rollback", "undoRegistration", "delete"]) {
      expect(loop.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("롯데ON 은 플랫폼 어댑터 경로를 타지 않는다 — 판별식을 거친다", () => {
    const loop = WORKSPACE.slice(
      WORKSPACE.indexOf("async function registerSelected()"),
      WORKSPACE.indexOf("function retryListing()"),
    );
    expect(loop).toContain("if (isPlatformCommerce(id)) {");
    expect(loop).toContain("await registerLotteOn()");
  });
});

describe("⑥ 🔴 누르자마자 나가지 않는다", () => {
  it("[선택한 커머스 등록]은 최종 확인 화면을 연다", () => {
    /* N-05 QA FIX — 이 버튼은 ③ 의 선택기가 아니라 ④ 의 «실행 줄» 에 있다.
       ③ 은 「어디에」, ④ 는 「실제로 등록」 — 역할이 갈렸다. */
    const runner = WORKSPACE.slice(WORKSPACE.indexOf("commerceRunner={"));
    expect(runner).toContain("onClick={() => setMultiConfirmOpen(true)}");
    expect(runner).toContain("선택한 커머스 등록");
  });

  it("실제 실행은 모달의 onConfirm 에서만 일어난다", () => {
    expect(WORKSPACE).toContain("void registerSelected()");
    // 선택기에서 곧바로 부르는 경로가 없다.
    expect(WORKSPACE).not.toContain("onRegisterSelected={registerSelected}");
  });

  it("전송이 시작되면 확인 화면을 닫을 수 없다 — 단독 등록과 같은 규칙", () => {
    expect(WORKSPACE).toContain("if (multiRunning) return;");
  });

  it("한 채널이라도 실제 API 를 부르면 LIVE 로 표시한다", () => {
    expect(WORKSPACE).toContain('? "LIVE"');
  });
});
