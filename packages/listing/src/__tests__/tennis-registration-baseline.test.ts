import { describe, expect, it } from "vitest";
import type { CanonicalProduct, CanonicalProductImage, FieldSource, ProvenanceField } from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { buildNaverProductPayload } from "../naver/build-payload";
import { validateNaverPayload } from "../naver/validate-payload";
import { selectCoupangNoticeCategory } from "../coupang/build-payload";
import { buildLotteOnPayload, BLANK_LOTTEON_CHANNEL_CONFIG } from "../lotteon/build-payload";
import { validateLotteOnPayload } from "../lotteon/validate-payload";
import { noticeSchemaFor } from "../lotteon/notice-schema";
/* PHASE 3-1(이번 스프린트) — ②③④ 가 만든 함수를 «그대로» 쓴다. 지어낸 값이 없다. */
import { resolveCareInstructions } from "../notice/care-instructions";
import { BULK_REFERENCE_FIELDS, planProductBulkReference } from "../notice/bulk-reference";
import { resolveProductDetailBlocks } from "../common/detail-override";
import { assembleNaverDetailContent } from "../naver/build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TENNIS-READY-TO-REGISTER-01 STEP 1 — **테니스 의류 기준선을 «측정» 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 아동의류는 3채널 중 둘이 Production 검증됐다. 테니스(성인 스포츠웨어)는 처음이고,
 * 조사만으로는 「아마 통과할 것」밖에 말할 수 없다. 그래서 실제로 통과시켜 본다.
 *
 * 🔴 이 파일의 일부 단정은 «현재 동작» 을 고정한 것이고, 그중 일부는 «결함» 이다.
 * 결함을 고정한 자리에는 🔴 DEFECT 주석을 달았다 — 고치는 날 그 단정을 «뒤집는 것»
 * 이 그 작업의 일부다. 결함을 「통과」로 위장해 두지 않는다.
 *
 * 🔴 fixture 는 더럽게 만든다([[fixtures-must-be-dirty]]) — 원산지는 국가명이 아니라
 * 「Made in Vietnam」 문장으로, 소재는 원문 영어로, 이미지에는 업로드 실패분을 섞는다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function image(over: Partial<CanonicalProductImage> & { id: string; originalUrl: string }): CanonicalProductImage {
  return {
    selectedVariant: "ORIGINAL",
    isRepresentative: false,
    useInProductGallery: true,
    useInDescription: true,
    classification: "PRODUCT",
    ...over,
  } as CanonicalProductImage;
}

/** 성인 여성 테니스 원피스 — 실제 해외 편집샵 상품의 «모양» 을 따른다. */
function tennisProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/womens-tennis-dress",
    title: field("Women's Performance Tennis Dress"),
    brand: field("Lacoste"),
    price: field({ amount: 118, currency: "GBP" }),
    priceValidity: "VALID",
    sku: field("TN-DRESS-01"),
    description: field("Lightweight performance tennis dress with built-in shorts."),
    /* 🔴 원문 그대로다 — 한국어로 «정리된» 값을 넣으면 실제 유입 형태를 못 잰다. */
    material: field("92% Polyester, 8% Elastane"),
    color: field("White / Navy"),
    /* 🔴 성인이라 비어 있다. 아동 fixture 를 베껴 「4-5세」를 넣으면 성인 경로를 못 잰다. */
    recommendedAge: field(""),
    manufacturer: field("Lacoste Operations SAS"),
    careInstructions: field("Machine wash at 30°C"),
    options: field([]),
    optionGroups: [{ name: "Size", values: ["S", "M", "L"] }],
    variants: [
      { optionValues: { Size: "S" }, stockQuantity: 4, sku: "TN-DRESS-01-S" },
      { optionValues: { Size: "M" }, stockQuantity: 2, sku: "TN-DRESS-01-M" },
      { optionValues: { Size: "L" }, stockQuantity: 0, sku: "TN-DRESS-01-L" },
    ],
    images: [
      image({ id: "rep", originalUrl: "https://cdn.example.com/tennis/rep.jpg", isRepresentative: true }),
      image({ id: "a1", originalUrl: "https://cdn.example.com/tennis/1.jpg" }),
    ],
    titleKo: field("여성 퍼포먼스 테니스 원피스"),
    descriptionKo: field("속바지 일체형 경량 테니스 원피스."),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    /* 🔴 「Vietnam」이 아니라 문장으로 온다 — LOTTEON-FINAL-03 에서 실제로 이 형태였다. */
    countryOfOrigin: field("Made in Vietnam"),
    returnPolicy: field("14일 이내 반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(6),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field("테니스 원피스"),
    modelName: field("TN-DRESS-01"),
    weight: field("210g"),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    ...overrides,
  } as unknown as CanonicalProduct;
}

/* ══════════════════════════════════════════════════════════════════════════
   ① SmartStore — 성인은 WEAR 로 가는가, 아동 칸이 새지 않는가
   ══════════════════════════════════════════════════════════════════════════ */

const NAVER_BUILD = {
  leafCategoryId: "50000167",
  releaseAddressBookNo: 1,
  refundAddressBookNo: 2,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  childCertificationInfoId: 1041,
  /* 🔴 성인이므로 false — 이 플래그 하나가 KIDS/WEAR 를 가른다(compliance.ts:232). */
  categoryRequiresChildCertification: false,
  originAreaCode: "0200037",
  originAreaRequiresContent: false,
  deliveryCompany: "CJGLS",
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터",
  afterServiceTelephoneNumber: "02-000-0000",
} as const;

const NAVER_VALIDATE = {
  releaseAddressBookNo: 1,
  refundAddressBookNo: 2,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  returnCompaniesFetchFailed: false,
  childCertificationInfoId: 1041,
  originAreaCode: "0200037",
  originAreaRequiresImporter: false,
  deliveryCompany: "CJGLS",
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터",
  afterServiceTelephoneNumber: "02-000-0000",
} as const;

function naverOf(product: CanonicalProduct) {
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
  const payload = buildNaverProductPayload({ product, listing, ...NAVER_BUILD });
  return { payload, validation: validateNaverPayload(payload, { product, ...NAVER_VALIDATE }, false) };
}

const blockingFields = (v: ReturnType<typeof naverOf>["validation"]) =>
  v.fields.filter((f) => f.status !== "READY" && !f.optional).map((f) => f.field);

describe("① SmartStore — 성인 테니스 의류는 WEAR 로 간다", () => {
  it("고시 유형이 WEAR 다 — 아동 카테고리가 아니면 KIDS 가 붙지 않는다", () => {
    const notice = naverOf(tennisProduct()).payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice?.productInfoProvidedNoticeType).toBe("WEAR");
  });

  it("🔴 아동 전용 칸이 payload 에 «새지 않는다»", () => {
    const json = JSON.stringify(naverOf(tennisProduct()).payload);
    expect(json).not.toContain("recommendedAge");
    expect(json).not.toContain("productCertificationInfos");
    expect(json).not.toContain('"kids"');
  });

  it("🔴 아동 전용 «검증» 도 서지 않는다 — 성인이 KIDS 사유로 막히지 않는다", () => {
    const blocked = blockingFields(naverOf(tennisProduct()).validation);
    expect(blocked.filter((f) => f.includes("KIDS"))).toEqual([]);
    expect(blocked.filter((f) => f.includes("productCertificationInfos"))).toEqual([]);
    expect(blocked.filter((f) => f.includes("naverShoppingSearchInfo"))).toEqual([]);
  });

  it("원문 그대로의 소재·색상·취급주의가 WEAR 고시를 채운다 — 한국어로 정리돼 있지 않아도 된다", () => {
    const blocked = blockingFields(naverOf(tennisProduct()).validation);
    for (const f of ["material", "color", "caution", "manufacturer"]) {
      expect(blocked.filter((b) => b.endsWith(`.${f}`)), `${f} 가 막혔다`).toEqual([]);
    }
  });

  it("치수는 SIZE 옵션에서 채워진다 — 테니스 원피스의 S/M/L 이 그 소스다", () => {
    const notice = naverOf(tennisProduct()).payload.originProduct.detailAttribute
      ?.productInfoProvidedNotice as { wear?: { size?: string } } | undefined;
    expect(notice?.wear?.size).toContain("S");
  });
});

describe("① SmartStore — 잘못된 옵션·가격·재고는 막힌다 (완료기준 확인)", () => {
  it("옵션 조합에 빈 값이 있으면 막는다", () => {
    const product = tennisProduct({
      optionGroups: [
        { name: "Size", values: ["S", "M"] },
        { name: "Color", values: ["White"] },
      ],
      /* Color 값이 없는 조합 — 원본 파싱이 일부만 성공한 실제 모양이다. */
      variants: [{ optionValues: { Size: "S" }, stockQuantity: 3 }],
    } as unknown as Partial<CanonicalProduct>);
    expect(blockingFields(naverOf(product).validation)).toContain(
      "detailAttribute.optionInfo.optionCombinations[].optionName",
    );
  });

  it("원본 재고가 «전부 0» 이면 막는다 — 품절 상품을 등록하지 않는다", () => {
    const product = tennisProduct({
      variants: [
        { optionValues: { Size: "S" }, stockQuantity: 0 },
        { optionValues: { Size: "M" }, stockQuantity: 0 },
      ],
      stockQuantity: field(0),
    } as unknown as Partial<CanonicalProduct>);
    expect(blockingFields(naverOf(product).validation)).toContain("originProduct.stockQuantity");
  });

  it("가격을 확인할 수 없으면 막는다", () => {
    const product = tennisProduct({ priceValidity: "MISSING" } as unknown as Partial<CanonicalProduct>);
    expect(blockingFields(naverOf(product).validation)).toContain("originProduct.salePrice");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ② 롯데ON — 고시 품목 표를 «모르는» 품목에서 무엇이 나오는가
   ══════════════════════════════════════════════════════════════════════════ */

function lotteOnChannel(overrides: Record<string, unknown> = {}) {
  return {
    ...BLANK_LOTTEON_CHANNEL_CONFIG,
    saleStartDate: "20260930",
    saleEndDate: "20991231",
    trGrpCd: "SR",
    trNo: "LO10000",
    standardCategoryNo: "BC63080300",
    displayCategories: [{ mallCd: "LTON", lfDcatNo: "FC11130203" }],
    originCode: "KR",
    taxTypeCode: "01",
    outboundPlaceNo: "115",
    returnPlaceNo: "115",
    deliveryCostPolicyNo: "335",
    deliveryRegionGroupCode: "GN101",
    ...overrides,
  } as never;
}

const lotteOnCheck = (channel: never) => {
  const result = validateLotteOnPayload({ product: tennisProduct(), channel, detailHtml: "<p>상세</p>" } as never);
  return {
    ok: result.ok,
    notice: result.fields.find((f: { field: string }) => f.field === "pdItmsArtlLst"),
  };
};

const ARTICLES_01_FULL = [
  { pdArtlCd: "0010", pdArtlCnts: "폴리에스터 92% 엘라스테인 8%" },
  { pdArtlCd: "0020", pdArtlCnts: "화이트/네이비" },
  { pdArtlCd: "0030", pdArtlCnts: "S / M / L" },
  { pdArtlCd: "0070", pdArtlCnts: "Lacoste Operations SAS / 따조" },
  { pdArtlCd: "0060", pdArtlCnts: "베트남" },
  { pdArtlCd: "0050", pdArtlCnts: "30도 이하 세탁" },
  { pdArtlCd: "0040", pdArtlCnts: "상세페이지 참조" },
  { pdArtlCd: "0080", pdArtlCnts: "소비자분쟁해결기준에 따름" },
  { pdArtlCd: "0090", pdArtlCnts: "따져 고객센터 / 02-000-0000" },
];

describe("② 롯데ON — 성인 의류는 품목 01「의류」로 간다", () => {
  it("표에 들여온 품목은 01(의류)·23(어린이제품) 둘이다", () => {
    expect(noticeSchemaFor("01")).not.toBeNull();
    expect(noticeSchemaFor("23")).not.toBeNull();
    /* 🔴 나머지는 여전히 «모른다». 이번 변경은 품목 01 만 열었다. */
    for (const code of ["02", "10", "24", "99"]) {
      expect(noticeSchemaFor(code), `품목 ${code} 표가 생겼다면 이 테스트를 고쳐라`).toBeNull();
    }
  });

  it("🔴 품목 01 은 9항목이고 «표의 순서» 그대로다 — 숫자 오름차순이 아니다", () => {
    expect(noticeSchemaFor("01")!.map((s) => s.code)).toEqual([
      "0010",
      "0020",
      "0030",
      "0070",
      "0060",
      "0050",
      "0040",
      "0080",
      "0090",
    ]);
  });

  it("🔴 9항목 전부 필수다 — PDF 「필수여부」 열이 9행 모두 Y 였다", () => {
    expect(noticeSchemaFor("01")!.every((s) => s.required)).toBe(true);
  });

  it("🔴 품목 01 의 0090 이름을 품목 23 에서 «가져오지 않았다» — 코드가 같아도 이름은 갈릴 수 있다", () => {
    const a01 = noticeSchemaFor("01")!.find((s) => s.code === "0090")!;
    const a23 = noticeSchemaFor("23")!.find((s) => s.code === "0090")!;
    expect(a01.label).toBe("A/S");
    expect(a23.label).toBe("A/S 책임자와 전화번호");
  });

  it("품목 01 을 «전부» 채우면 고시 항목이 통과한다", () => {
    const { notice } = lotteOnCheck(
      lotteOnChannel({ noticeItemCode: "01", noticeArticles: ARTICLES_01_FULL }),
    );
    expect(notice?.status).toBe("READY");
  });

  it("🔴 품목 01 에서 필수 항목이 하나라도 빠지면 «막는다» — 빠진 이름을 말한다", () => {
    const { notice, ok } = lotteOnCheck(
      lotteOnChannel({
        noticeItemCode: "01",
        noticeArticles: ARTICLES_01_FULL.filter((a) => a.pdArtlCd !== "0050"),
      }),
    );
    expect(ok).toBe(false);
    expect(notice?.status).toBe("BLOCKED");
    expect(notice?.reason).toContain("세탁방법");
  });

  it("🔴 항목 «한 개» 만 채운 품목 01 은 이제 막힌다 — 테니스가 타던 구멍이 닫혔다", () => {
    const { notice } = lotteOnCheck(
      lotteOnChannel({ noticeItemCode: "01", noticeArticles: [{ pdArtlCd: "0020", pdArtlCnts: "화이트" }] }),
    );
    expect(notice?.status).toBe("BLOCKED");
  });

  it("품목 23 은 항목이 모자라면 «막는다» — 실측 9999 거절을 반영한 가드", () => {
    const { notice } = lotteOnCheck(
      lotteOnChannel({ noticeItemCode: "23", noticeArticles: [{ pdArtlCd: "0020", pdArtlCnts: "화이트" }] }),
    );
    expect(notice?.status).toBe("BLOCKED");
  });

  it("🔴 DEFECT (남아 있음) — 표를 «모르는» 품목은 항목 «한 개» 로도 READY 가 된다", () => {
    /* ── 무엇이 문제인가 ──────────────────────────────────────────────────
       롯데ON 은 품목의 고시 항목을 «전부» 요구한다. 추정이 아니라
       LOTTEON-FINAL-07 의 «첫 실제 CREATE 응답» 으로 확인됐다:
           returnCode 0000 / 9999 상품품목항목코드 필수값이 누락입니다
       표를 «모르는» 품목은 필수 목록이 빈 배열이 되어(validate-payload.ts:223)
       한 개만 채워도 READY 가 된다 — 화면은 「등록 가능」, 롯데ON 은 9999 거절.

       🔴 테니스는 이제 이 경로를 «타지 않는다»(품목 01 표를 들여왔다). 그러나
          구멍 자체는 남아 있고, 이번 승인 범위가 아니어서 고치지 않았다.
          그래서 코드를 «아직 모르는» 02 로 바꿔 계속 고정해 둔다 — 결함을
          「테니스가 해결됐으니 없다」로 위장하지 않는다.
       🔴 이 단정이 실패하는 날이 그 구멍이 닫힌 날이다. */
    const { notice } = lotteOnCheck(
      lotteOnChannel({ noticeItemCode: "02", noticeArticles: [{ pdArtlCd: "0020", pdArtlCnts: "화이트" }] }),
    );
    expect(notice?.status, "🔴 이제 READY 가 아니라면 구멍이 닫혔다는 뜻이다").toBe("READY");
  });

  /* ══ TENNIS-READY-TO-REGISTER-03 STEP 2.4 ═══════════════════════════════
     「검증기가 READY 라고 한다」와 「payload 에 실제로 실린다」는 다른 질문이다.
     9항목이 pdItmsArtlLst 로 «그대로» 나가는지 payload 원문에서 확인한다. */
  it("🔴 품목 01 의 9항목이 등록 payload(pdItmsArtlLst)에 그대로 실린다", () => {
    const payload = buildLotteOnPayload({
      product: tennisProduct(),
      channel: lotteOnChannel({ noticeItemCode: "01", noticeArticles: ARTICLES_01_FULL }),
      detailHtml: "<p>상세</p>",
    } as never) as unknown as {
      spdLst: { pdItmsInfo?: { pdItmsCd?: string; pdItmsArtlLst?: { pdArtlCd: string; pdArtlCnts: string }[] } }[];
    };
    /* 🔴 고시는 spdLst[0] 직속이 아니라 pdItmsInfo 안에 중첩돼 있다
       (build-payload.ts:415). 처음에 직속이라고 짚었고 실행이 바로잡았다. */
    const info = payload.spdLst[0]!.pdItmsInfo;
    expect(info?.pdItmsCd).toBe("01");
    const sent = info?.pdItmsArtlLst ?? [];
    expect(sent).toHaveLength(9);
    /* 순서도 내용도 우리가 넣은 것 그대로다 — 재정렬·가공하지 않는다. */
    expect(sent.map((a) => a.pdArtlCd)).toEqual(ARTICLES_01_FULL.map((a) => a.pdArtlCd));
    expect(sent.map((a) => a.pdArtlCnts)).toEqual(ARTICLES_01_FULL.map((a) => a.pdArtlCnts));
    /* 필수 9개가 «전부» 실렸는가 — 스키마와 대조한다(개수만 세지 않는다). */
    const required = noticeSchemaFor("01")!.filter((x) => x.required).map((x) => x.code);
    expect(new Set(sent.map((a) => a.pdArtlCd))).toEqual(new Set(required));
  });

  it("품목코드를 아예 비우면 막는다 — 「모른다」와 「없다」는 갈려 있다", () => {
    const { notice, ok } = lotteOnCheck(lotteOnChannel({ noticeItemCode: "", noticeArticles: [] }));
    expect(ok).toBe(false);
    expect(notice?.status).toBe("BLOCKED");
  });

  it("원산지는 문장으로 와도 코드로 바뀐다 — 「Made in Vietnam」 회귀", () => {
    const payload = buildLotteOnPayload({
      product: tennisProduct(),
      channel: lotteOnChannel({ noticeItemCode: "23", noticeArticles: [{ pdArtlCd: "0020", pdArtlCnts: "화이트" }] }),
      detailHtml: "<p>상세</p>",
    } as never);
    expect(JSON.stringify(payload)).not.toContain("Made in Vietnam");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ③ 쿠팡 — 고시 카테고리 선택이 테니스 의류를 어디로 보내는가
   ══════════════════════════════════════════════════════════════════════════ */

describe("③ 🔴 쿠팡 — 의류는 고시 카테고리 키워드 표에 «없다»", () => {
  /* 🔴 「의류」라는 이름은 실측이 아니다 — 리포지터리 안에서 이 문자열은 테스트
     픽스처에만 있다. 그래서 이 테스트는 「의류라는 이름이면 이렇게 돼야 한다」를
     주장하지 «않는다». 주장하는 것은 하나다: 이름이 표에 없으면 선택이
     «필드 수» 로 떨어지고, 그때 KC 가 있는 쪽이 이길 수 있다. */
  const clothing = {
    noticeCategoryName: "의류",
    noticeCategoryDetailNames: [
      { noticeCategoryDetailName: "제품 소재", required: "MANDATORY" },
      { noticeCategoryDetailName: "색상", required: "MANDATORY" },
      { noticeCategoryDetailName: "치수", required: "MANDATORY" },
      { noticeCategoryDetailName: "제조자", required: "MANDATORY" },
      { noticeCategoryDetailName: "세탁방법 및 취급시 주의사항", required: "MANDATORY" },
      { noticeCategoryDetailName: "품질보증기준", required: "MANDATORY" },
    ],
  } as never;
  /* 「기타 재화」는 실측된 이름이다(build-payload.ts:846 주석의 뷰티 실측). */
  const misc = {
    noticeCategoryName: "기타 재화",
    noticeCategoryDetailNames: [
      { noticeCategoryDetailName: "품명 및 모델명", required: "MANDATORY" },
      { noticeCategoryDetailName: "인증/허가 사항", required: "MANDATORY" },
    ],
  } as never;

  it("모자·신발·가방·화장품 넷만 표에 있다 — 의류는 없다", () => {
    /* 표에 있는 이름은 KC-free 쪽으로 «승격» 된다. hat 이 그 증거다. */
    const hats = {
      noticeCategoryName: "모자",
      noticeCategoryDetailNames: [
        { noticeCategoryDetailName: "종류", required: "MANDATORY" },
        { noticeCategoryDetailName: "소재", required: "MANDATORY" },
        { noticeCategoryDetailName: "치수", required: "MANDATORY" },
      ],
    } as never;
    expect(selectCoupangNoticeCategory([misc, hats], "Performance Tennis Hat")?.noticeCategoryName).toBe("모자");
  });

  it("🔴 DEFECT — 테니스 원피스는 필드 수가 적은 쪽으로 떨어진다(KC 항목이 있어도)", () => {
    const chosen = selectCoupangNoticeCategory([clothing, misc], "Women's Performance Tennis Dress");
    expect(chosen?.noticeCategoryName, "🔴 「의류」가 선택된다면 표에 줄이 생긴 것이다").toBe("기타 재화");
    /* 그 결과 KC/인증 칸이 남는다 — 이것이 CP007 위험의 입구다. */
    expect(chosen?.noticeCategoryDetailNames.some((d: { noticeCategoryDetailName: string }) =>
      d.noticeCategoryDetailName.includes("인증"),
    )).toBe(true);
  });

  /* 🔴🔴 이 자리에서 조사(추정)가 뒤집혔다.
     나는 「아동 어휘가 없으면 어린이 고시로 가지 않는다」를 먼저 단정으로 적었고,
     실행이 «어린이제품» 을 돌려줬다. 이유는 단순하다 —

         isLikelyChildrenProduct 는 어린이 고시를 «올릴» 때만 쓰이고,
         내릴 때는 아무 데도 쓰이지 않는다(build-payload.ts:866).
         그래서 fallback 인 「필드 수 최소」가 어린이제품을 그냥 고를 수 있다.

     성인 상품에 어린이제품 고시가 붙으면 사용연령 같은 아동 항목이 필수가 되고,
     KC/인증 칸이 남아 CP007 로 이어진다. 테니스는 성인이라 «항상» 이 경로다. */
  const children = {
    noticeCategoryName: "어린이제품",
    noticeCategoryDetailNames: [{ noticeCategoryDetailName: "사용연령", required: "MANDATORY" }],
  } as never;

  it("🔴 고쳤다 — 성인 상품이면 fallback 에서 어린이제품 고시를 배제한다", () => {
    expect(
      selectCoupangNoticeCategory([children, misc], "Women's Performance Tennis Dress")?.noticeCategoryName,
      "🔴 어린이제품이 다시 나오면 대칭 가드가 사라진 것이다",
    ).toBe("기타 재화");
  });

  it("대조군 — 아동 어휘가 있으면 어린이 고시가 이긴다(이 동작은 «유지»돼야 한다)", () => {
    expect(selectCoupangNoticeCategory([children, misc], "Kids Tennis Dress")?.noticeCategoryName).toBe("어린이제품");
  });

  it("🔴 어린이제품 «하나뿐» 이면 예전 그대로 그것을 고른다 — undefined 를 돌려주지 않는다", () => {
    /* 배제가 후보를 0개로 만드는 경우. 여기서 undefined 가 나가면 고시정보가
       아예 비어 등록이 조용히 망가진다 — 배제보다 나쁜 결과다. */
    expect(selectCoupangNoticeCategory([children], "Women's Performance Tennis Dress")?.noticeCategoryName).toBe(
      "어린이제품",
    );
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ④ TENNIS-FIRST-PRODUCT-DISCOVERY-02 — 첫 등록 대상은 «성인 남성 테니스 상의» 다
   ══════════════════════════════════════════════════════════════════════════

   🔴 이 fixture 는 «상품 유형» 을 재기 위한 것이고, 실제 등록 상품이 아니다.
   CPO 가 준 샘플(Sergio Tacchini Men's Fall Magro Top)의 «유형» 만 따른다 —
   남성 · 상의 · 테니스웨어 · 사이즈 축 하나. 그 페이지를 수집하지 «않았다»
   (지시: 샘플을 자동 수집하거나 재고·사이즈를 추정해 등록하지 않는다).

   🔴 그래서 아래 재고·사이즈 값은 «샘플의 실제 값이 아니다». 코드 경로를 재기
   위한 임의값이고, 이 fixture 로 실제 등록을 판정하지 않는다. 실제 등록 상품의
   재고·사이즈는 DB 의 snapshot 에서 확인해야 하며 그것은 아직 못 봤다.

   재는 것은 하나다: 「여성 원피스」와 「남성 상의」가 채널 분류에서 갈리는가.
   성별·품목이 달라지면 고시 유형이 바뀔 수 있고, 그것이 첫 등록의 위험이다. */
function mensTennisTop(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return tennisProduct({
    sourceUrl: "https://example.com/products/mens-tennis-top",
    title: field("Men's Fall Magro Top"),
    brand: field("Sergio Tacchini"),
    titleKo: field("남성 폴 마그로 테니스 상의"),
    itemName: field("남성 테니스 상의"),
    sku: field("STMFMT0-WH"),
    modelName: field("STMFMT0"),
    color: field("White"),
    material: field("100% Polyester"),
    optionGroups: [{ name: "Size", values: ["S", "M", "L", "XL"] }],
    variants: [
      { optionValues: { Size: "S" }, stockQuantity: 2, sku: "STMFMT0-WH-S" },
      { optionValues: { Size: "M" }, stockQuantity: 5, sku: "STMFMT0-WH-M" },
      { optionValues: { Size: "L" }, stockQuantity: 3, sku: "STMFMT0-WH-L" },
      { optionValues: { Size: "XL" }, stockQuantity: 1, sku: "STMFMT0-WH-XL" },
    ],
    ...overrides,
  } as unknown as Partial<CanonicalProduct>);
}

describe("④ 성인 남성 테니스 상의 — 3채널 분류가 여성 원피스와 «같은가»", () => {
  it("SmartStore: 남성 상의도 WEAR 다 — 성별이 고시 유형을 바꾸지 않는다", () => {
    const notice = naverOf(mensTennisTop()).payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice?.productInfoProvidedNoticeType).toBe("WEAR");
  });

  it("🔴 SmartStore: 아동 칸이 새지 않고, KIDS 사유로 막히지도 않는다", () => {
    const { payload, validation } = naverOf(mensTennisTop());
    expect(JSON.stringify(payload)).not.toContain('"kids"');
    expect(blockingFields(validation).filter((f) => f.includes("KIDS"))).toEqual([]);
  });

  it("SmartStore: 사이즈 4개가 옵션으로 실리고 치수 고시를 채운다", () => {
    const { payload, validation } = naverOf(mensTennisTop());
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos).toHaveLength(4);
    /* 옵션값이 하나도 비지 않았다 — 빈 옵션 가드가 서지 않아야 한다. */
    expect(blockingFields(validation)).not.toContain(
      "detailAttribute.optionInfo.optionCombinations[].optionName",
    );
  });

  it("🔴 쿠팡: 「Men's」 상품이 어린이제품 고시로 가지 않는다", () => {
    const children = {
      noticeCategoryName: "어린이제품",
      noticeCategoryDetailNames: [{ noticeCategoryDetailName: "사용연령", required: "MANDATORY" }],
    } as never;
    const misc = {
      noticeCategoryName: "기타 재화",
      noticeCategoryDetailNames: [
        { noticeCategoryDetailName: "품명 및 모델명", required: "MANDATORY" },
        { noticeCategoryDetailName: "인증/허가 사항", required: "MANDATORY" },
      ],
    } as never;
    const name = mensTennisTop().title.value;
    expect(selectCoupangNoticeCategory([children, misc], name)?.noticeCategoryName).toBe("기타 재화");
  });

  it("🔴 롯데ON: 남성 상의도 품목 01 의 9항목이 payload 에 그대로 실린다", () => {
    const payload = buildLotteOnPayload({
      product: mensTennisTop(),
      channel: lotteOnChannel({ noticeItemCode: "01", noticeArticles: ARTICLES_01_FULL }),
      detailHtml: "<p>상세</p>",
    } as never) as unknown as {
      spdLst: { pdItmsInfo?: { pdItmsCd?: string; pdItmsArtlLst?: { pdArtlCd: string }[] } }[];
    };
    const info = payload.spdLst[0]!.pdItmsInfo;
    expect(info?.pdItmsCd).toBe("01");
    expect(info?.pdItmsArtlLst).toHaveLength(9);
  });

  it("🔴 재고가 «전부 0» 이면 남성 상의도 막힌다 — 임의 수량으로 채우지 않는다", () => {
    const product = mensTennisTop({
      variants: [
        { optionValues: { Size: "S" }, stockQuantity: 0 },
        { optionValues: { Size: "M" }, stockQuantity: 0 },
      ],
      stockQuantity: field(0),
    } as unknown as Partial<CanonicalProduct>);
    expect(blockingFields(naverOf(product).validation)).toContain("originProduct.stockQuantity");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ⑤ 지정 상품 «실제 값» 으로 — 무엇을 채우면 열리는가
   ══════════════════════════════════════════════════════════════════════════

   Sergio Tacchini Men's Fall Magro Top (CPO 지정, 2026-09-30).
   아래 값은 공개 상품 페이지에서 «읽은» 사실이다 — 지어낸 것이 없다:

     가격      $68.00 USD              소재    65% Cotton, 30% Polyester, 5% Elastane
     색상      Brilliant White         모델    STF26M51684-050
     사이즈    S · M · L · XL · XXL    재고    S:3 · M:4+ · L:4+ · XL:4+ · XXL:3
     성별      Men's                   원산지  «없음»      세탁방법 «없음»

   🔴 수집 파이프라인을 돌리지 «않았다». 이것은 상품을 등록하는 코드가 아니라,
   「이 값들이면 채널이 무엇을 막는가」를 미리 재는 자리다.

   🔴 재고 「4+」는 수량이 아니다. 그래서 M·L·XL 을 null 로 둔다 — 4 로 적으면
   그 순간 우리의 추정이 된다. 셀러가 OptionVariantEditor 에서 정할 칸이다. */
function magroTop(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return tennisProduct({
    sourceUrl: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Fall_Magro_Top/descpageMASGT-STMFMT0.html",
    title: field("Sergio Tacchini Men's Fall Magro Top"),
    brand: field("Sergio Tacchini"),
    titleKo: field("세르지오 타키니 남성 폴 마그로 상의"),
    itemName: field("남성 테니스 상의"),
    sku: field("STMFMT0-WH"),
    modelName: field("STF26M51684-050"),
    price: field({ amount: 68, currency: "USD" }),
    priceValidity: "VALID",
    material: field("65% Cotton, 30% Polyester, 5% Elastane"),
    color: field("Brilliant White"),
    /* 🔴 페이지에 없다. 비운다 — 채널이 무엇을 막는지 보려는 것이다. */
    countryOfOrigin: field(""),
    careInstructions: field(""),
    recommendedAge: field(""),
    optionGroups: [{ name: "Size", values: ["S", "M", "L", "XL", "XXL"] }],
    variants: [
      { optionValues: { Size: "S" }, stockQuantity: 3, sku: "STMFMT0-WH-S" },
      /* 「4+」 — 모른다. null 이다. */
      { optionValues: { Size: "M" }, stockQuantity: null, sku: "STMFMT0-WH-M" },
      { optionValues: { Size: "L" }, stockQuantity: null, sku: "STMFMT0-WH-L" },
      { optionValues: { Size: "XL" }, stockQuantity: null, sku: "STMFMT0-WH-XL" },
      { optionValues: { Size: "XXL" }, stockQuantity: 3, sku: "STMFMT0-WH-XXL" },
    ],
    ...overrides,
  } as unknown as Partial<CanonicalProduct>);
}

/* 🔴 상속 «없음». 페이지에서 관측한 칸만 채우고 나머지는 전부 비운다.
   magroTop() 은 tennisProduct() 를 상속해 관측하지 않은 값(상세설명·반품정책·
   중량 등)을 물려받는다 — 그것이 차단 목록을 실제보다 짧게 보이게 했다. */
function magroTopObserved(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Fall_Magro_Top/descpageMASGT-STMFMT0.html",
    title: field("Sergio Tacchini Men's Fall Magro Top"),
    brand: field("Sergio Tacchini"),
    price: field({ amount: 68, currency: "USD" }),
    priceValidity: "VALID",
    sku: field("STMFMT0-WH"),
    modelName: field("STF26M51684-050"),
    material: field("65% Cotton, 30% Polyester, 5% Elastane"),
    color: field("Brilliant White"),
    /* 페이지에 «없는» 것들 — 비운다. */
    description: field(""), manufacturer: field(""), careInstructions: field(""),
    countryOfOrigin: field(""), recommendedAge: field(""), returnPolicy: field(""),
    weight: field(""), certification: field(""), certificationType: field(""),
    importer: field(""), itemName: field(""), childCertification: field(null),
    titleKo: field(""), descriptionKo: field(""), keywords: field([]),
    seoTitle: field(""), seoDescription: field(""),
    options: field([]),
    optionGroups: [{ name: "Size", values: ["S", "M", "L", "XL", "XXL"] }],
    variants: [
      { optionValues: { Size: "S" }, stockQuantity: 3, sku: "STMFMT0-WH-S" },
      { optionValues: { Size: "M" }, stockQuantity: null, sku: "STMFMT0-WH-M" },
      { optionValues: { Size: "L" }, stockQuantity: null, sku: "STMFMT0-WH-L" },
      { optionValues: { Size: "XL" }, stockQuantity: null, sku: "STMFMT0-WH-XL" },
      { optionValues: { Size: "XXL" }, stockQuantity: 3, sku: "STMFMT0-WH-XXL" },
    ],
    images: [image({ id: "rep", originalUrl: "https://cdn.example/rep.jpg", isRepresentative: true })],
    shippingFee: field(0, "DEFAULT"), stockQuantity: field(6),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    ...overrides,
  } as unknown as CanonicalProduct;
}

/** 원산지 텍스트가 채워진 뒤의 상태 — 브랜드 기본값이 채우는 자리다. */
const ORIGIN_FILLED = { ...NAVER_BUILD, originAreaCode: "0200037" } as const;
const ORIGIN_FILLED_V = { ...NAVER_VALIDATE, originAreaCode: "0200037" } as const;
/** 원산지를 «아직 모르는» 상태 — resolveCommonOrigin 이 셋 다 비면 코드가 null 이다. */
const ORIGIN_EMPTY = { ...NAVER_BUILD, originAreaCode: null } as const;
const ORIGIN_EMPTY_V = { ...NAVER_VALIDATE, originAreaCode: null } as const;

function naverWith(product: CanonicalProduct, build: object, validate: object) {
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
  const payload = buildNaverProductPayload({ product, listing, ...build } as never);
  return validateNaverPayload(payload, { product, ...validate } as never, false);
}
const blockedOf = (v: ReturnType<typeof naverWith>) =>
  v.fields.filter((f) => f.status !== "READY" && !f.optional).map((f) => f.field);

describe("⑤ 지정 상품 — 원산지 하나가 문을 막는다", () => {
  it("🔴 원산지가 비면 SmartStore 가 막는다 — 실제 차단 항목 ①의 실행 확인", () => {
    const blocked = blockedOf(naverWith(magroTop(), ORIGIN_EMPTY, ORIGIN_EMPTY_V));
    expect(blocked).toContain("detailAttribute.originAreaInfo.originAreaCode");
  });

  it("🔴 원산지를 채우면 그 항목이 «사라진다» — 브랜드 기본값 한 칸의 효과", () => {
    const blocked = blockedOf(naverWith(magroTop(), ORIGIN_FILLED, ORIGIN_FILLED_V));
    expect(blocked).not.toContain("detailAttribute.originAreaInfo.originAreaCode");
  });

  /* ══ 🔴 상속을 «끊고» 다시 잰다 (CPO 정정, 2026-09-30) ════════════════════
     직전에 나는 「남은 차단은 제조사·세탁방법 둘뿐」이라고 단정해 커밋했다.
     그 단정이 «fixture 산물» 이었다 — magroTop() 이 tennisProduct() 를 상속해
     description·returnPolicy·weight 같은 칸을 물려받고 있었다. 페이지에서
     관측한 칸만 채운 독립 fixture 로 재면 «세» 개다(상세설명이 더 나온다).

     🔴 그래서 이 단정은 「운영 환경의 최종 차단 목록」이 아니다. 이 입력에서
     이 결과가 나온다는 것뿐이다 — 실제 수집 데이터·운영 설정으로 다시 재야
     한다. 테스트 이름에 그 범위를 적어 둔다. */
  it("🔴 [probe 범위] 관측값만 채운 지정 상품 — 차단 3건: 상세설명·제조사·세탁방법", () => {
    const blocked = blockedOf(naverWith(magroTopObserved(), ORIGIN_FILLED, ORIGIN_FILLED_V));
    expect(blocked.sort()).toEqual([
      "originProduct.detailContent",
      "productInfoProvidedNotice(WEAR).caution",
      "productInfoProvidedNotice(WEAR).manufacturer",
    ]);
  });

  it("🔴 제조사는 «상세페이지 참조» 가 기존 규칙에서 허용된다 — 임의 값을 넣지 않아도 된다", () => {
    /* CPO 지시: 「출처에서 확인되지 않으면 임의로 채우지 말고, 기존 고시 검증
       규칙에서 허용되는 입력값을 확인한다」. 확인 결과 그 값이 통과한다. */
    const product = magroTopObserved({
      manufacturer: { value: "상세페이지 참조", source: "USER_EDITED", confidence: 1 },
    } as unknown as Partial<CanonicalProduct>);
    const blocked = blockedOf(naverWith(product, ORIGIN_FILLED, ORIGIN_FILLED_V));
    expect(blocked).not.toContain("productInfoProvidedNotice(WEAR).manufacturer");
  });

  it("🔴 Settings 가 비면 차단이 «더 늘어난다» — fixture 가 공급한 값의 크기를 적는다", () => {
    const noSettings = { warrantyPolicy: undefined, afterServiceDirector: undefined,
      afterServiceTelephoneNumber: undefined, deliveryCompany: undefined };
    const blocked = blockedOf(naverWith(magroTopObserved(),
      { ...ORIGIN_FILLED, ...noSettings }, { ...ORIGIN_FILLED_V, ...noSettings }));
    for (const f of ["deliveryInfo.deliveryCompany",
      "productInfoProvidedNotice(WEAR).warrantyPolicy",
      "productInfoProvidedNotice(WEAR).afterServiceDirector",
      "detailAttribute.afterServiceInfo.afterServiceTelephoneNumber"]) {
      expect(blocked, `${f} 가 Settings 없이도 통과하면 안 된다`).toContain(f);
    }
  });

  it("사이즈 5개가 옵션 5건으로 실리고 빈 옵션값 가드가 서지 않는다", () => {
    const v = naverWith(magroTop(), ORIGIN_FILLED, ORIGIN_FILLED_V);
    expect(blockedOf(v)).not.toContain("detailAttribute.optionInfo.optionCombinations[].optionName");
  });

  it("🔴 재고를 «모르는» 옵션이 섞여 있어도 등록 자체는 막히지 않는다", () => {
    /* S:3 · XXL:3 이 확인됐으므로 이 상품은 품절이 아니다. M·L·XL 의 null 은
       「모른다」이고, 그것 때문에 상품 전체가 막히면 셀러가 팔 수 있는 것을
       못 팔게 된다. 수량 결정은 셀러 몫으로 남는다. */
    expect(blockedOf(naverWith(magroTop(), ORIGIN_FILLED, ORIGIN_FILLED_V))).not.toContain(
      "originProduct.stockQuantity",
    );
  });

  it("🔴 성인 남성이라 KIDS 경로를 타지 않는다 — WEAR 고시다", () => {
    const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(
      magroTop(), UNRESOLVED_CATEGORY, undefined, "smartstore",
    );
    const payload = buildNaverProductPayload({ product: magroTop(), listing, ...ORIGIN_FILLED } as never);
    const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice?.productInfoProvidedNoticeType).toBe("WEAR");
    expect(JSON.stringify(payload)).not.toContain('"kids"');
  });

  it("🔴 쿠팡: 이 상품명이 어린이제품 고시로 가지 않는다", () => {
    const children = {
      noticeCategoryName: "어린이제품",
      noticeCategoryDetailNames: [{ noticeCategoryDetailName: "사용연령", required: "MANDATORY" }],
    } as never;
    const misc = {
      noticeCategoryName: "기타 재화",
      noticeCategoryDetailNames: [{ noticeCategoryDetailName: "품명 및 모델명", required: "MANDATORY" }],
    } as never;
    expect(
      selectCoupangNoticeCategory([children, misc], magroTop().title.value)?.noticeCategoryName,
    ).toBe("기타 재화");
  });

  it("🔴 롯데ON: 품목 01 9항목이 이 상품 payload 에도 그대로 실린다", () => {
    const payload = buildLotteOnPayload({
      product: magroTop(),
      channel: lotteOnChannel({ noticeItemCode: "01", noticeArticles: ARTICLES_01_FULL }),
      detailHtml: "<p>상세</p>",
    } as never) as unknown as {
      spdLst: { pdItmsInfo?: { pdItmsCd?: string; pdItmsArtlLst?: { pdArtlCd: string }[] } }[];
    };
    expect(payload.spdLst[0]!.pdItmsInfo?.pdItmsCd).toBe("01");
    expect(payload.spdLst[0]!.pdItmsInfo?.pdItmsArtlLst).toHaveLength(9);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ⑥ PHASE 3-1 — **이번 스프린트 UX ①~④ 가 이 상품을 실제로 여는가**
   ══════════════════════════════════════════════════════════════════════════

   ⑤ 가 못박은 차단 3건은 공교롭게도 URGENT UX 번들이 겨냥한 그 셋이다:

       originProduct.detailContent                   ← ④ 상세설명 자동 작성
       productInfoProvidedNotice(WEAR).caution       ← ③ 케어라벨 참조 기본값
       productInfoProvidedNotice(WEAR).manufacturer  ← ② 개별 「상세페이지 참조」

   🔴 그래서 「기능을 만들었다」가 아니라 **「그 기능을 통과시킨 뒤 차단이 실제로
   줄어드는가」** 를 잰다. 줄지 않으면 ①~④ 는 셀러에게 쓸모가 없다.

   🔴 여기서 임의 값을 넣지 않는다. 쓰는 것은 전부 «이번에 만든 함수의 출력» 이다:
       resolveCareInstructions(null)                    → "케어라벨 참조"
       mockProductContentProvider 는 listing 에서 못 쓴다(의존 방향) — 그래서
       descriptionKo 는 ④ 가 채운 «뒤의 상태» 를 모사하지 않고, 상세 블록이
       실제로 조립된 detailContent 를 넣어 ④ 의 효과를 잰다.
   🔴 원산지·제조사는 추정하지 않는다 — ⑤ 가 확인한 «허용되는 입력값» 만 쓴다. */
describe("⑥ PHASE 3-1 — 이번 UX 가 차단을 실제로 줄이는가", () => {
  /** ③ 이 수집 시점에 넣는 값. 지어낸 문자열이 아니라 함수 출력이다. */
  const careFromUx3 = resolveCareInstructions(null);

  it("🔴 ③ 케어라벨 기본값이 세탁방법 차단을 «없앤다»", () => {
    const before = blockedOf(naverWith(magroTopObserved(), ORIGIN_FILLED, ORIGIN_FILLED_V));
    expect(before).toContain("productInfoProvidedNotice(WEAR).caution");

    const after = blockedOf(
      naverWith(
        magroTopObserved({ careInstructions: careFromUx3 } as unknown as Partial<CanonicalProduct>),
        ORIGIN_FILLED,
        ORIGIN_FILLED_V,
      ),
    );
    expect(after).not.toContain("productInfoProvidedNotice(WEAR).caution");
  });

  it("🔴 ③ 이 넣은 값은 「케어라벨 참조」다 — 「상세페이지 참조」로 거짓말하지 않는다", () => {
    expect(careFromUx3.value).toBe("케어라벨 참조");
    expect(careFromUx3.source).toBe("DEFAULT");
    const payload = naverWith(
      magroTopObserved({ careInstructions: careFromUx3 } as unknown as Partial<CanonicalProduct>),
      ORIGIN_FILLED,
      ORIGIN_FILLED_V,
    );
    /* 세탁정보는 케어라벨에 있다 — 상세페이지에 없는 것을 있다고 적지 않는다. */
    expect(JSON.stringify(payload)).not.toContain("세탁방법은 상품 상세페이지 참조");
  });

  it("🔴 ② 개별 참조가 제조사 차단을 «없앤다» — bulk 에서는 제외된 그 칸이다", () => {
    const product = magroTopObserved({
      careInstructions: careFromUx3,
      /* ② 패널의 개별 참조 경로가 만드는 상태 그대로. */
      manufacturer: { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 },
    } as unknown as Partial<CanonicalProduct>);
    const blocked = blockedOf(naverWith(product, ORIGIN_FILLED, ORIGIN_FILLED_V));
    expect(blocked).not.toContain("productInfoProvidedNotice(WEAR).manufacturer");
  });

  it("🔴 그리고 제조사는 bulk 전체적용 대상이 «아니다» — 이 상품에서도 그렇다", () => {
    /* resolveManufacturer 의 5단 폴백을 참조가 멈추기 때문이다(CPO 확정 ⓐ).
       셀러가 «고를» 수는 있지만 버튼 하나로 일괄 적용되지는 않는다. */
    expect(BULK_REFERENCE_FIELDS as readonly string[]).not.toContain("manufacturer");
    const plan = planProductBulkReference(magroTopObserved());
    expect(plan.applied).not.toContain("manufacturer" as never);
    /* 반대로 이 상품에서 «실제로» 적용되는 칸이 있다 — 공허하지 않다. */
    expect(plan.applied.length).toBeGreaterThan(0);
  });

  it("🔴 ② 가 이 상품에서 여는 칸을 센다 — 빈칸만 바꾸고 관측값은 유지한다", () => {
    const plan = planProductBulkReference(magroTopObserved());
    /* 관측된 값(소재·색상)은 건드리지 않는다. */
    expect(plan.skipped.map((s) => s.field)).toContain("material");
    expect(plan.skipped.map((s) => s.field)).toContain("color");
    expect(plan.applied).toContain("itemName");
    expect(plan.applied).toContain("weight");
    expect(plan.applied).toContain("importer");
  });

  it("🔴 ④ 상세 블록이 조립되면 detailContent 차단이 «없어진다»", () => {
    /* 상세 블록은 셀러 설정에서 오고 상품이 아니라 서버가 조립한다.
       ⑤ 에서 detailContent 가 막힌 것은 NAVER_BUILD 에 블록이 없어서다 —
       실제 등록 경로는 resolveProductDetailBlocks 를 반드시 거친다. */
    const blocks = resolveProductDetailBlocks(null);
    const detailContent = assembleNaverDetailContent(blocks, {
      aiDescription: "65% 코튼 혼방 남성 테니스 상의입니다.",
      template: null,
      productImageUrls: ["https://cdn.example/rep.jpg"],
      sizeChartImageUrls: [],
      brandIntro: null,
      commonImages: {
        topCommonImageUrl: null,
        topCommonImageEnabled: false,
        bottomCommonImageUrl: null,
        bottomCommonImageEnabled: false,
      },
    } as never);
    expect(detailContent.length).toBeGreaterThan(20);

    const blocked = blockedOf(
      naverWith(
        magroTopObserved({ careInstructions: careFromUx3 } as unknown as Partial<CanonicalProduct>),
        { ...ORIGIN_FILLED, detailBlocks: blocks },
        ORIGIN_FILLED_V,
      ),
    );
    expect(blocked).not.toContain("originProduct.detailContent");
  });

  it("🔴 셋을 모두 적용하면 SmartStore 차단이 «0건» 이 된다 — probe 범위", () => {
    /* 🔴 이것은 「운영에서 등록된다」가 아니다. 이 입력·이 셀러 설정에서
       SmartStore 검증이 막는 항목이 없다는 뜻이다. 쿠팡 카테고리와 실제
       인증은 별개로 남아 있다(§H). */
    const product = magroTopObserved({
      careInstructions: careFromUx3,
      manufacturer: { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 },
    } as unknown as Partial<CanonicalProduct>);
    const blocked = blockedOf(
      naverWith(product, { ...ORIGIN_FILLED, detailBlocks: resolveProductDetailBlocks(null) }, ORIGIN_FILLED_V),
    );
    expect(blocked).toEqual([]);
  });

  it("🔴 그래도 재고 「4+」는 «여전히 모른다» — 열렸다고 4 로 채우지 않는다", () => {
    const product = magroTopObserved();
    const unknownStock = product.variants.filter((v) => v.stockQuantity === null);
    expect(unknownStock).toHaveLength(3); // M · L · XL
    /* 🔴 어디에도 4 가 들어가 있지 않다. */
    expect(JSON.stringify(product.variants)).not.toContain('"stockQuantity":4');
  });
});
