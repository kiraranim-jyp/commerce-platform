import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnPayload,
  buildLotteOnSalePeriod,
  type LotteOnChannelConfig,
  type LotteOnPayloadInput,
} from "../build-payload";
import { validateLotteOnPayload, LOTTEON_NOTICE_ITEM_CODE_CHILDREN } from "../validate-payload";
import { lotteOnAdapter } from "../adapter";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 3 — 실제 API 호출 없이 payload 생성/검증
 * 계약을 고정한다. 이 테스트가 지키는 것은 세 가지다:
 *
 *  1) 가격이 기존 단일 출처(resolveListingPrice)를 그대로 탄다 — 롯데ON만의
 *     별도 가격 경로가 생기면 여기서 값이 어긋난다.
 *  2) 채널 전용 값(카테고리/고시/안전인증/출고지)이 없으면 **등록이 막힌다** —
 *     빈 값으로 "성공한 것처럼 보이는 등록"이 나가지 않는다.
 *  3) 유아동(품목코드 23) 상품은 안전인증 없이는 절대 통과하지 못한다 —
 *     이 저장소의 주력 카테고리라 회피할 수 없는 규칙이다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

const PRODUCT_FINAL_KRW = 143500;

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
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
    manufacturer: field("테스트제조사"),
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
    titleKo: field("테스트 상품"),
    descriptionKo: field(""),
    keywords: field(["키워드1", "키워드2", "키워드3", "키워드4", "키워드5", "키워드6"]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("대한민국"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    /* 🔴 ③ D-LOT-STOCK(2026-10-11) — 이 fixture 는 「모든 채널 전용 값이 채워진
       상태 = 등록 가능의 기준선」이라고 적어 놓고 재고를 **`DEFAULT`** 로 두고
       있었다. `DEFAULT` 는 파이프라인 기본값이고 «실측이 아니다» — 즉 원본
       기준으로는 「재고 모름」이다. 재고 정책이 「모르면 막는다」로 확정되면서
       그 모순이 드러났다(검증기가 MISSING 하나를 올린다).
       🔴 기대값을 고쳐 맞추지 «않고» fixture 를 고친다 — 같은 이유로 이 파일의
       taxTypeCode(:90)와 고시 항목(:94)을 이미 두 번 고쳤다. */
    stockQuantity: field(30, "ORIGINAL"),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field("MODEL-1"),
    weight: field(""),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(PRODUCT_FINAL_KRW, "USER_EDITED"),
    ...overrides,
  };
}

/** 모든 채널 전용 값이 채워진 상태 — "등록 가능"의 기준선. */
function completeChannel(overrides: Partial<LotteOnChannelConfig> = {}): LotteOnChannelConfig {
  return {
    ...BLANK_LOTTEON_CHANNEL_CONFIG,
    ...buildLotteOnSalePeriod(new Date("2026-09-14T00:00:00Z")),
    trGrpCd: "SR",
    trNo: "LO10000",
    standardCategoryNo: "BC63080300",
    displayCategories: [{ mallCd: "LTON", lfDcatNo: "FC11130203" }],
    originCode: "KR",
    /* 🔴 이 fixture 는 「모든 채널 전용 값이 채워진 상태」라고 적어 놓고 과세를
       «채우지 않았다». BLANK 설정의 조용한 "01"(관행 기본값)에 기대고 있었다 —
       그래서 주장이 사실이 아니었다. 기본값을 없애니 이 줄이 바로 드러났다. */
    taxTypeCode: "01",
    /* 🔴 TENNIS-03 — 이 fixture 는 「모든 채널 전용 값이 채워진 상태」라고 적어 놓고
       고시 항목을 «한 개» 만 넣고 있었다. 품목 01 의 표를 모르던 동안에는 그것이
       통과했고(필수 목록이 빈 배열), 그래서 「모든 값이 채워지면 통과한다」는 이
       파일의 주장이 사실이 아니었다 — 롯데ON 은 9999 로 거절할 상태였다.
       품목 01 표(9항목, 전부 필수)를 들여오면서 드러났다. 이제 실제로 채운다. */
    noticeItemCode: "01",
    noticeArticles: [
      { pdArtlCd: "0010", pdArtlCnts: "면 100%" },
      { pdArtlCd: "0020", pdArtlCnts: "블루" },
      { pdArtlCd: "0030", pdArtlCnts: "S / M / L" },
      { pdArtlCd: "0070", pdArtlCnts: "테스트제조사 / 따조" },
      { pdArtlCd: "0060", pdArtlCnts: "대한민국" },
      { pdArtlCd: "0050", pdArtlCnts: "찬물 손세탁" },
      { pdArtlCd: "0040", pdArtlCnts: "상세페이지 참조" },
      { pdArtlCd: "0080", pdArtlCnts: "소비자분쟁해결기준에 따름" },
      { pdArtlCd: "0090", pdArtlCnts: "따져 고객센터 / 02-000-0000" },
    ],
    outboundPlaceNo: "115",
    returnPlaceNo: "115",
    deliveryCostPolicyNo: "335",
    deliveryRegionGroupCode: "GN101",
    ...overrides,
  };
}

function inputFor(product: CanonicalProduct, channel: LotteOnChannelConfig, detailHtml = "<p>상세</p>"): LotteOnPayloadInput {
  return { product, channel, detailHtml };
}

describe("buildLotteOnPayload", () => {
  it("가격은 기존 단일 출처(resolveListingPrice)를 그대로 쓴다 — 롯데ON 전용 계산이 없다", () => {
    const payload = buildLotteOnPayload(inputFor(makeProduct(), completeChannel()));
    expect(payload.spdLst[0].itmLst[0].slPrc).toBe(PRODUCT_FINAL_KRW);
  });

  it("옵션이 없으면 단품 1건 · sitmYn='N'", () => {
    const payload = buildLotteOnPayload(inputFor(makeProduct(), completeChannel()));
    const registration = payload.spdLst[0];
    expect(registration.sitmYn).toBe("N");
    expect(registration.itmLst).toHaveLength(1);
    expect(registration.itmLst[0].rprtSitmYn).toBe("Y");
    expect(registration.optSrtLst).toBeUndefined();
  });

  it("옵션 조합을 우리가 만들어내지 않는다 — variants에 있는 것만 단품이 된다", () => {
    const product = makeProduct({
      // 옵션 축은 2×2지만 실제 조합은 2건만 확인됐다 → 단품도 2건이어야 한다.
      optionGroups: [
        { name: "색상", values: ["블루", "레드"] },
        { name: "사이즈", values: ["S", "M"] },
      ],
      variants: [
        { id: "v1", optionValues: { 색상: "블루", 사이즈: "S" }, stockQuantity: 3 },
        { id: "v2", optionValues: { 색상: "레드", 사이즈: "M" }, stockQuantity: 5 },
      ],
    });
    const registration = buildLotteOnPayload(inputFor(product, completeChannel())).spdLst[0];
    expect(registration.sitmYn).toBe("Y");
    expect(registration.itmLst).toHaveLength(2);
    expect(registration.itmLst.map((i) => i.stkQty)).toEqual([3, 5]);
    // optSrtLst는 단품에 실제로 등장한 값만 담는다.
    expect(registration.optSrtLst?.map((o) => o.optNm)).toEqual(["색상", "사이즈"]);
    expect(registration.optSrtLst?.[0].optValSrtLst.map((v) => v.optVal)).toEqual(["블루", "레드"]);
  });

  it("옵션 판매가는 차액이 아니라 절대 판매가로 실린다(Naver와 반대 — 롯데ON 스키마)", () => {
    const product = makeProduct({
      optionGroups: [{ name: "사이즈", values: ["S", "L"] }],
      variants: [
        { id: "v1", optionValues: { 사이즈: "S" }, price: { amount: 88, currency: "GBP" }, priceMode: "ABSOLUTE" },
        { id: "v2", optionValues: { 사이즈: "L" }, price: { amount: 98, currency: "GBP" }, priceMode: "ABSOLUTE" },
      ],
    });
    const items = buildLotteOnPayload(inputFor(product, completeChannel())).spdLst[0].itmLst;
    expect(items[0].slPrc).toBe(PRODUCT_FINAL_KRW);
    // 두 번째 단품은 기본가보다 비싸야 한다(차액 0이 아니라 절대가).
    expect(items[1].slPrc).toBeGreaterThan(PRODUCT_FINAL_KRW);
  });

  it("검색키워드는 5개까지만 싣는다(문서 상한)", () => {
    const registration = buildLotteOnPayload(inputFor(makeProduct(), completeChannel())).spdLst[0];
    expect(registration.scKwdLst).toHaveLength(5);
  });

  it("상품 1건만 보낸다 — 일괄 등록 인터페이스를 만들지 않는다", () => {
    expect(buildLotteOnPayload(inputFor(makeProduct(), completeChannel())).spdLst).toHaveLength(1);
  });

  it("채널 값이 없으면 빈 문자열로 남기고 임의 기본값을 지어내지 않는다", () => {
    const registration = buildLotteOnPayload(
      inputFor(makeProduct(), { ...BLANK_LOTTEON_CHANNEL_CONFIG }),
    ).spdLst[0];
    expect(registration.scatNo).toBe("");
    expect(registration.owhpNo).toBe("");
    expect(registration.dcatLst).toEqual([]);
  });
});

describe("validateLotteOnPayload", () => {
  it("모든 채널 값이 채워지면 통과한다", () => {
    const result = validateLotteOnPayload(inputFor(makeProduct(), completeChannel()));
    expect(result.blockedCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.ok).toBe(true);
  });

  it("표준/전시 카테고리가 없으면 등록을 막는다 — 쿠팡/네이버 카테고리를 재사용할 수 없다", () => {
    const result = validateLotteOnPayload(
      inputFor(makeProduct(), completeChannel({ standardCategoryNo: null, displayCategories: [] })),
    );
    expect(result.ok).toBe(false);
    const blocked = result.fields.filter((f) => f.code === "CATEGORY_REQUIRED").map((f) => f.field);
    expect(blocked).toEqual(expect.arrayContaining(["scatNo", "dcatLst"]));
  });

  it("품목코드 23(어린이제품)은 안전인증 없이 절대 통과하지 못한다", () => {
    const result = validateLotteOnPayload(
      inputFor(makeProduct(), completeChannel({ noticeItemCode: LOTTEON_NOTICE_ITEM_CODE_CHILDREN })),
    );
    expect(result.ok).toBe(false);
    expect(result.fields.find((f) => f.field === "sftyAthnLst")?.code).toBe("SAFETY_CERTIFICATION_REQUIRED");
  });

  it("KC계열 안전인증을 넣으면 수입대행코드가 필수다", () => {
    const withKc = completeChannel({
      noticeItemCode: LOTTEON_NOTICE_ITEM_CODE_CHILDREN,
      safetyCertifications: [{ sftyAthnTypCd: "KC_CHL_PKG", sftyAthnNo: "ABC-123" }],
    });
    const blockedResult = validateLotteOnPayload(inputFor(makeProduct(), withKc));
    expect(blockedResult.fields.find((f) => f.field === "impPrxCd")?.code).toBe("IMPORT_PROXY_REQUIRED");

    const okResult = validateLotteOnPayload(inputFor(makeProduct(), { ...withKc, importProxyCode: "PUR_PRX" }));
    expect(okResult.fields.find((f) => f.field === "impPrxCd")?.status).toBe("READY");
  });

  it("어린이제품 안전확인(CHL_CFM)은 수입대행코드를 요구하지 않는다(문서 표 그대로)", () => {
    const result = validateLotteOnPayload(
      inputFor(
        makeProduct(),
        completeChannel({
          noticeItemCode: LOTTEON_NOTICE_ITEM_CODE_CHILDREN,
          safetyCertifications: [{ sftyAthnTypCd: "CHL_CFM", sftyAthnNo: "CB-1234" }],
        }),
      ),
    );
    /* 🔴 LOTTEON-FINAL-07 — 축을 «수입대행코드» 하나로 좁힌다. 품목 23 은 이제
       고시 13항목을 전부 요구하므로(실측 9999) `ok` 로 재면 애먼 이유로 깨진다. */
    expect(result.fields.find((f) => f.field === "impPrxCd")).toBeUndefined();
    expect(result.fields.find((f) => f.field === "sftyAthnLst")?.status).toBe("READY");
  });

  /* ══════════════════════════════════════════════════════════════════════════
     LOTTEON-FINAL-05 #2(CEO 지시, 2026-09-29) — 안전인증 **3상태**

     바로 위 「안전인증 없이 절대 통과하지 못한다」는 그대로 살아 있다. 달라진
     것은 그 규칙을 «푸는 길이 하나 더» 생겼다는 것이다:

       미선택   아직 고른 적 없다   → 품목 23 이면 예전과 똑같이 막힌다
       TARGET   대상이다            → 실제 인증정보가 있어야 한다
       EXCLUDED 대상이 아니다       → 인증정보를 요구하지 않는다

     🔴 이 블록이 지키는 핵심은 **미선택 ≠ 대상 아님** 하나다. 그 구별이
     무너지면 아무것도 고르지 않은 상품이 조용히 「대상 아님」으로 등록된다 —
     스마트스토어에서 「12313ㄹㅇ」이 나간 것과 같은 종류의 사고다.
     ═══════════════════════════════════════════════════════════════════════ */
  describe("안전인증 3상태 — 미선택 / 대상 / 대상 아님", () => {
    const childrenChannel = (overrides: Partial<LotteOnChannelConfig> = {}) =>
      completeChannel({ noticeItemCode: LOTTEON_NOTICE_ITEM_CODE_CHILDREN, ...overrides });
    const safety = (result: ReturnType<typeof validateLotteOnPayload>) =>
      result.fields.find((f) => f.field === "sftyAthnLst");

    it("🔴 미선택은 「대상 아님」이 아니다 — 품목 23 에서 그대로 막힌다", () => {
      const result = validateLotteOnPayload(inputFor(makeProduct(), childrenChannel()));
      expect(childrenChannel().safetyTarget, "fixture 가 이미 고른 상태면 이 검사는 아무것도 증명하지 않는다").toBeNull();
      expect(result.ok).toBe(false);
      expect(safety(result)?.status).toBe("BLOCKED");
      expect(safety(result)?.code).toBe("SAFETY_CERTIFICATION_REQUIRED");
    });

    it("「대상 아님」을 고르면 인증정보 없이 통과한다 — 이것이 없던 출구다", () => {
      const result = validateLotteOnPayload(inputFor(makeProduct(), childrenChannel({ safetyTarget: "EXCLUDED" })));
      /* 🔴 이 블록의 축은 안전인증 «하나» 다. 고시(pdItmsArtlLst)는 별개 축이고
         실측 9999 이후 따로 막힌다 — `ok` 로 재면 그 규칙에 끌려다닌다. */
      expect(safety(result)?.status).toBe("READY");
      /* 🔴 화면이 「따져가 확인했다」로 읽히면 안 된다 — 판매자의 «신고» 다. */
      expect(safety(result)?.label).toContain("판매자 신고");
    });

    it("「대상 아님」인데 인증정보가 같이 있으면 막는다 — 반쪽 신고를 보내지 않는다", () => {
      const result = validateLotteOnPayload(
        inputFor(
          makeProduct(),
          childrenChannel({
            safetyTarget: "EXCLUDED",
            safetyCertifications: [{ sftyAthnTypCd: "CHL_CFM", sftyAthnNo: "CB-1234" }],
          }),
        ),
      );
      expect(result.ok).toBe(false);
      expect(safety(result)?.code).toBe("SAFETY_DECLARATION_CONFLICT");
    });

    it("「대상」을 골랐는데 인증정보가 없으면 품목코드와 무관하게 막는다", () => {
      /* 🔴 품목 23 이 «아닌» 상품으로 잰다. 품목코드가 막는 것인지 신고가 막는
         것인지 구별되지 않으면 이 검사는 아무것도 증명하지 않는다. */
      const result = validateLotteOnPayload(
        inputFor(makeProduct(), completeChannel({ noticeItemCode: "01", safetyTarget: "TARGET" })),
      );
      expect(result.ok).toBe(false);
      expect(safety(result)?.code).toBe("SAFETY_CERTIFICATION_REQUIRED");
    });

    it("「대상」 + 실제 인증정보면 통과한다", () => {
      const result = validateLotteOnPayload(
        inputFor(
          makeProduct(),
          childrenChannel({
            safetyTarget: "TARGET",
            safetyCertifications: [{ sftyAthnTypCd: "CHL_ATHN", sftyAthnNo: "CB-9999" }],
          }),
        ),
      );
      expect(safety(result)?.status).toBe("READY");
    });

    it("「대상 아님」이어도 인증번호를 지어내지 않는다 — payload 에 sftyAthnLst 가 아예 없다", () => {
      const payload = buildLotteOnPayload(inputFor(makeProduct(), childrenChannel({ safetyTarget: "EXCLUDED" })));
      expect(payload.spdLst[0].sftyAthnLst).toBeUndefined();
    });

    it("품목 23 이 아니면 미선택이어도 이 축을 묻지 않는다(기존 동작 그대로)", () => {
      const result = validateLotteOnPayload(inputFor(makeProduct(), completeChannel({ noticeItemCode: "01" })));
      expect(safety(result)).toBeUndefined();
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
     LOTTEON-FINAL-08(CEO 결정, 2026-09-29) — **등록 ≠ 전시**

     Production 실측: 쿠팡·스마트스토어는 임시저장으로 앉는데 롯데ON 만 등록 즉시
     매대에 걸렸다. 셀러가 검수하기 전에 팔리기 시작하는 상태다.

     🔴 원인은 버그가 아니라 «우리가 정한 기본값» 이었다 — `dpYn: "Y"`. 문서가
     그 값을 「근거 0」이라고 스스로 적어 두었는데도 그대로 나갔다.
     ═══════════════════════════════════════════════════════════════════════ */
  it("🔴 등록은 «전시안함» 으로 나간다 — 셀러가 확인하기 전에 팔리지 않는다", () => {
    const payload = buildLotteOnPayload(inputFor(makeProduct(), completeChannel()));
    expect(payload.spdLst[0].dpYn).toBe("N");
  });

  it("🔴 어떤 입력으로도 전시로 «뒤집히지» 않는다 — 판매자가 정할 일이다", () => {
    /* 채널 값을 바꿔도 이 축은 움직이지 않는다. 화면에 토글이 없는 것이 요점이고,
       생기더라도 그것은 CEO 정책 변경이지 폼 입력이 아니다. */
    for (const channel of [
      completeChannel(),
      completeChannel({ noticeItemCode: LOTTEON_NOTICE_ITEM_CODE_CHILDREN, safetyTarget: "EXCLUDED" }),
      completeChannel({ originCode: "ES", taxTypeCode: "02" }),
    ]) {
      expect(buildLotteOnPayload(inputFor(makeProduct(), channel)).spdLst[0].dpYn).toBe("N");
    }
  });

  it("출고지/회수지/배송비정책/배송가능지역이 없으면 막는다 — 임의 번호를 보낼 수 없다", () => {
    const result = validateLotteOnPayload(
      inputFor(
        makeProduct(),
        completeChannel({
          outboundPlaceNo: null,
          returnPlaceNo: null,
          deliveryCostPolicyNo: null,
          deliveryRegionGroupCode: null,
        }),
      ),
    );
    const blocked = result.fields.filter((f) => f.code === "SELLER_PLACE_REQUIRED").map((f) => f.field);
    expect(blocked).toEqual(["owhpNo", "rtrpNo", "dvCstPolNo", "dvRgsprGrpCd"]);
  });

  it("가격을 계산하지 못하면 막는다", () => {
    const product = makeProduct({ priceValidity: "MISSING", priceOverrideKrw: undefined });
    const result = validateLotteOnPayload(inputFor(product, completeChannel()));
    expect(result.fields.find((f) => f.field === "slPrc")?.code).toBe("PRICE_UNRESOLVED");
  });

  it("상세페이지에 롯데ON 임시 이미지 경로가 남아 있으면 막는다", () => {
    const result = validateLotteOnPayload(
      inputFor(
        makeProduct(),
        completeChannel(),
        '<img src="https://doc-pub.lotteon.com/ec/public/tmp/a.jpg">',
      ),
    );
    expect(result.fields.find((f) => f.field === "epnLst")?.code).toBe("TEMP_IMAGE_URL");
  });

  it("거래처 정보(207 Identity)를 못 얻으면 막는다", () => {
    const result = validateLotteOnPayload(inputFor(makeProduct(), completeChannel({ trGrpCd: null, trNo: null })));
    expect(result.fields.find((f) => f.field === "trNo")?.code).toBe("IDENTITY_REQUIRED");
  });
});

describe("lotteOnAdapter (NextGenMarketplaceAdapter 계약)", () => {
  it("PlatformId가 아니라 자체 id로 식별된다", () => {
    expect(lotteOnAdapter.id).toBe("lotteon");
    expect(lotteOnAdapter.status).toBe("LIVE");
  });

  it("인증키가 없으면 NOT_CONFIGURED, 있으면 READY_FOR_CONNECTION", () => {
    expect(lotteOnAdapter.resolveConnectionStatus(false)).toBe("NOT_CONFIGURED");
    expect(lotteOnAdapter.resolveConnectionStatus(true)).toBe("READY_FOR_CONNECTION");
  });

  it("카테고리/속성/배송은 추측하지 않고 UNRESOLVED로 남긴다", () => {
    const product = makeProduct();
    expect(lotteOnAdapter.resolveCategory(product).status).toBe("UNRESOLVED");
    expect(lotteOnAdapter.resolveAttributes(product, lotteOnAdapter.resolveCategory(product)).status).toBe("UNRESOLVED");
    expect(lotteOnAdapter.resolveDelivery(product).status).toBe("UNRESOLVED");
  });

  it("채널 설정 없이 buildPayload하면 무엇이 비었는지 issues로 알려준다", () => {
    const result = lotteOnAdapter.buildPayload(makeProduct());
    const fields = result.issues.map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(["scatNo", "dcatLst", "owhpNo", "rtrpNo"]));
  });

  it("register()는 어댑터 층에서 실행되지 않는다 — 서버 라우트가 담당한다", async () => {
    const result = await lotteOnAdapter.register({ spdLst: [] });
    expect(result.status).toBe("NOT_IMPLEMENTED");
    expect(result.message).toContain("/api/lotteon/register");
  });
});

/* ── REWORK-10 A ────────────────────────────────────────────────────────── */

describe("REWORK-10 A — 롯데ON도 전 채널 공통 제조사 resolver를 탄다", () => {
  /**
   * 🔴 BEFORE: 이 파일의 제조사 줄은 `product.manufacturer.value.trim()` 하나였다.
   * 쿠팡·스마트스토어는 브랜드 프로필 → 판매자 기본정보까지 내려가는데 롯데ON만
   * 원문이 비면 mfcrNm을 통째로 빼고 보냈다 — 같은 상품이 채널마다 다른 제조사로
   * (또는 제조사 없이) 등록되는 상태였다.
   */
  function manufacturerOf(input: Partial<LotteOnPayloadInput>, product = makeProduct()): string | undefined {
    const payload = buildLotteOnPayload({
      ...inputFor(product, completeChannel()),
      ...input,
    });
    return payload.spdLst[0].mfcrNm;
  }

  it("① 상품 원문이 있으면 그것이 이긴다 — 기존 동작 그대로", () => {
    expect(
      manufacturerOf({ brandProfileManufacturer: "브랜드제조사", sellerProfileManufacturer: "판매자제조사" }),
    ).toBe("테스트제조사");
  });

  it("② 원문이 없으면 브랜드 프로필이 mfcrNm에 실린다 — BEFORE에는 필드 자체가 없었다", () => {
    const product = makeProduct({ manufacturer: field("") });
    expect(manufacturerOf({ brandProfileManufacturer: "Bobo Choses S.L." }, product)).toBe(
      "Bobo Choses S.L.",
    );
  });

  it("③ 브랜드 프로필도 없으면 «브랜드명» (PIVOT NEXT-04c-2)", () => {
    /* 🔴 원래는 「판매자 기본정보」였다. 판매 사업자를 제조사로 쓰라고 말하는
       채널이 없다 — 3커머스 공통 규칙은 실제 제조사 → 브랜드명 → 확인 필요다. */
    const product = makeProduct({ manufacturer: field(""), brand: field("Bobo Choses") });
    expect(manufacturerOf({}, product)).toBe("Bobo Choses");
  });

  it("④ 브랜드조차 없으면 값을 지어내지 않는다 — mfcrNm을 아예 싣지 않는다", () => {
    const product = makeProduct({ manufacturer: field(""), brand: field("") });
    expect(manufacturerOf({}, product)).toBeUndefined();
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 §6 — **판매자 인프라 번호는 «먼저 등록돼 있어야» 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 출고지·반품지·배송비정책·배송가능지역은 롯데ON 판매자센터(또는 거래처 API)에
 * 선등록돼 있어야 하는 값이다. 🔴 임의 값을 지어내 보낼 수 없고, 없는 채로
 * 87(상품등록)을 부르면 마켓 쪽에서 무엇이 만들어질지 우리가 모른다.
 *
 * 🔴 그렇다고 «신규 등록 기능 자체» 를 막지 않는다(CTO 명시). 값이 채워지면
 * 그 축은 READY 로 바뀌고 등록이 진행된다 — 아래 마지막 케이스가 그것이다.
 */
describe("P0-CHANNEL-03 §6 — 롯데ON 판매자 선결조건", () => {
  const PREREQ = [
    ["owhpNo", "outboundPlaceNo"],
    ["rtrpNo", "returnPlaceNo"],
    ["dvCstPolNo", "deliveryCostPolicyNo"],
    ["dvRgsprGrpCd", "deliveryRegionGroupCode"],
  ] as const;

  it.each(PREREQ)("%s 가 없으면 BLOCKED — 등록 API 를 부르지 않는다", (field, configKey) => {
    const result = validateLotteOnPayload(
      inputFor(makeProduct(), completeChannel({ [configKey]: null })),
    );
    const hit = result.fields.find((f) => f.field === field);
    expect(hit?.status).toBe("BLOCKED");
    expect(hit?.code).toBe("SELLER_PLACE_REQUIRED");
    /* 🔴 BLOCKED 가 하나라도 있으면 라우트가 멈춘다(register/route.ts 가
       validation.ok 를 87 호출 «앞» 에서 본다). */
    expect(result.ok).toBe(false);
  });

  it("🔴 네 값이 다 있으면 READY 다 — 선결조건이 신규 등록을 «같이 막지» 않는다", () => {
    const result = validateLotteOnPayload(inputFor(makeProduct(), completeChannel()));
    for (const [field] of PREREQ) {
      expect(result.fields.find((f) => f.field === field)?.status).toBe("READY");
    }
  });

  it("🔴 빈 문자열도 «없는 것» 으로 본다 — 공백을 값으로 인정하면 그대로 나간다", () => {
    const result = validateLotteOnPayload(
      inputFor(makeProduct(), completeChannel({ outboundPlaceNo: "" })),
    );
    expect(result.fields.find((f) => f.field === "owhpNo")?.status).toBe("BLOCKED");
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   P5.6 P0-5(CPO 지시, 2026-10-09) — 🔴 **999 를 재고로 싣지 않는다.**

   CEO 실측: 롯데ON 만 재고가 999 로 들어갔다. 999 는 파이프라인 DEFAULT 이고
   원본의 사실이 아니다. 지금까지 이 저장소에 `stkQty` 회귀 테스트가 «없었다» —
   그래서 되돌아가도 아무도 모른다. 여기서 고정한다.

   실측 모양: Tennis Magro 사이즈 5개 · 재고 1/4/2/3/1 (합계 11)
   ───────────────────────────────────────────────────────────────────────── */
describe("🔴🔴 P5.6 P0-5 재고 — 999 를 싣지 않는다", () => {
  const sizes = ["S", "M", "L", "XL", "XXL"];
  const stocks = [1, 4, 2, 3, 1];
  const withVariants = () =>
    makeProduct({
      stockQuantity: { value: 999, source: "DEFAULT" as FieldSource, confidence: 0 } as ProvenanceField<number>,
      optionGroups: [{ name: "사이즈", values: sizes }],
      variants: sizes.map((sz, i) => ({
        id: `STMMLSWH${i + 1}`,
        optionValues: { 사이즈: sz },
        sku: `STMMLSWH${i + 1}`,
        stockQuantity: stocks[i],
      })),
    });

  it("🔴 옵션별 재고가 «그대로» 실린다 — 합계로 뭉개지 않는다", () => {
    const items = buildLotteOnPayload(inputFor(withVariants(), completeChannel())).spdLst[0].itmLst;
    expect(items.map((i) => i.stkQty)).toEqual(stocks);
  });

  it("🔴 어느 항목에도 999 가 없다", () => {
    const items = buildLotteOnPayload(inputFor(withVariants(), completeChannel())).spdLst[0].itmLst;
    expect(items.map((i) => i.stkQty)).not.toContain(999);
  });

  it("🔴 옵션이 없으면 DEFAULT 999 가 «그대로» 나가지 않는다 — 원본 사실만 쓴다", () => {
    const bare = makeProduct({
      stockQuantity: { value: 999, source: "DEFAULT" as FieldSource, confidence: 0 } as ProvenanceField<number>,
      optionGroups: [],
      variants: [],
    });
    const items = buildLotteOnPayload(inputFor(bare, completeChannel())).spdLst[0].itmLst;
    /* 🔴 payloadStockQuantity 가 원본 실측을 못 찾으면 상품 레벨 값을 쓴다.
       그 값이 DEFAULT 999 라면 그것은 «재고 정보 없음» 이지 재고 999 가 아니다 —
       이 단언이 FAIL 하면 999 가 채널로 나가고 있다는 뜻이다. */
    expect(items[0].stkQty, "DEFAULT 999 가 채널로 나간다").not.toBe(999);
  });

  it("옵션 재고가 전부 0이면 등록을 막는다 — 품절을 재고로 포장하지 않는다", () => {
    const soldOut = makeProduct({
      optionGroups: [{ name: "사이즈", values: sizes }],
      variants: sizes.map((sz, i) => ({ id: `x${i}`, optionValues: { 사이즈: sz }, stockQuantity: 0 })),
    });
    const items = buildLotteOnPayload(inputFor(soldOut, completeChannel())).spdLst[0].itmLst;
    expect(items.every((i) => i.stkQty === 0)).toBe(true);
  });
});
