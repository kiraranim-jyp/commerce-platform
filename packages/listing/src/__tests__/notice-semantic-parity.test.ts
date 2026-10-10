import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { buildNaverProductPayload } from "../naver/build-payload";
import { buildCoupangPayload, BLANK_COUPANG_SELLER_CONFIG } from "../coupang/build-payload";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnPayload,
  buildLotteOnSalePeriod,
  type LotteOnChannelConfig,
} from "../lotteon/build-payload";
import { resolveLotteOnNotice } from "../lotteon/notice-resolve";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ② 3-Commerce Semantic Notice Parity (NOTICE-PARITY-02, CPO 지시 2026-10-10)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 묻는 것은 JSON 동일성이 «아니다» — 세 구조는 서로 다르다.
 *
 *     Naver     originProduct.detailAttribute.productInfoProvidedNotice.{kids|wear}
 *     Coupang   items[].notices[]            { noticeCategoryDetailName, content }
 *     LotteON   spdLst[].pdItmsInfo.pdItmsArtlLst  { pdArtlCd, pdArtlCnts }
 *
 * 묻는 것은 **「같은 상품 정보가 세 채널에서 같은 의미로 보존되는가」** 다.
 *
 * ── 🔴 이 파일이 지키는 네 가지 ─────────────────────────────────────────────
 *
 * ① **실제 builder 를 부른다.** adapter/model 만 비교하면 parity 가 아니다
 *    (`channel-notice-adapters.test.ts` 가 이미 그 층을 본다). 앞 세션이
 *    adapter 만 비교한 파일에 parity 라는 이름을 붙였다가 지웠다.
 * ② **builder 를 mock 하지 않는다.**
 * ③ **expected 는 손으로 쓴 리터럴이다.** 🔴 아래 코드 매핑을
 *    `channelNoticeMapping()` 에서 끌어오면 LotteON 쪽과 «같은 함수» 가
 *    expected·actual 을 동시에 만든다 — 순환이고, 그러면 매핑이 틀려도 통과한다.
 *    실제로 앞 세션이 그 순환에 걸려 순서 변조를 하나도 잡지 못했다.
 * ④ **LotteON 고시는 `resolveLotteOnNotice()` 결과로 만든다** — 손으로 적은
 *    `noticeArticles` 를 실제 결과처럼 쓰지 않는다(운영 경로가 그 resolver 다).
 *
 * ── 🔴 쿠팡 `required` 는 UNKNOWN 이다 (CPO 판정 (A)) ───────────────────────
 *
 * 이 저장소에 쿠팡 카테고리 메타 실제 응답 샘플이 **0건** 이다. 그리고 빌더는
 * `required === "MANDATORY"` 로 **항목을 걸러낸다**(coupang/build-payload.ts:1521)
 * — 즉 required 를 모른다는 것은 플래그 하나를 모르는 게 아니라 **항목 집합
 * 자체를 모른다**는 뜻이다. 그래서 아래 쿠팡 메타는 fixture 가 아니라 «실험
 * 조건» 이고, 이 파일은 required 를 **근거로 쓰지 않는다.**
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/* 🔴 canonical 기대값 — 독립 리터럴이다. fixture 가 이 값을 넣고, 세 payload 에서
   «이 문자열 그대로» 나오는지 본다.
   🔴 값은 추적 가능하게 둔다. "면 100%" 처럼 흔한 값은 어느 채널에서 왔는지
      구별할 수 없다.
   🔴 `countryOfOrigin` 은 "Made in Spain" — Production 에서 실제로 이 형태였다
      (정규화된 "스페인" 으로 재면 채널별 정규화 차이를 놓친다). */
const CANONICAL = {
  material: "코튼 97% 엘라스탄 3%",
  color: "미드나이트 네이비",
  /** 사이즈 옵션 두 개가 한 칸으로 합쳐진 형태. */
  size: "4Y, 6Y",
  manufacturer: "파리공방",
  countryOfOrigin: "Made in Spain",
  careInstructions: "30도 이하 손세탁",
  qualityGuarantee: "소비자분쟁해결기준에 따름",
  /** A/S 는 «업체명 + 전화번호» 두 조각이다(한 칸으로 합치면 전화번호 자리에 문장이 들어간다). */
  asContact: "따져 고객센터 / 02-000-0000",
} as const;

const SIZE_OPTION_VALUES = ["4Y", "6Y"] as const;
const AS_COMPANY = "따져 고객센터";
const AS_PHONE = "02-000-0000";

/* §3.6 의 확보된 입력 상수 — 재조사 금지. */
const LEAF_CATEGORY_ID = "50000535";
const PLACEHOLDER_RELEASE_ADDRESS = 900000001;
const PLACEHOLDER_REFUND_ADDRESS = 900000002;
/** 네이버 공통 인증 카탈로그 id — 판매자 식별정보가 «아니다»(§3.6). */
const CHILD_CERTIFICATION_CATALOG_ID = 1041;

/* 🔴 fixture 는 «더럽게» 만든다 — 크롤러가 채우지 않는 칸은 «비워서 명시» 한다.
   채워 넣으면 「되는 것처럼」 보이고, 실제로 그렇게 해서 고시 코드 셋을 한 단계
   과하게 확정한 적이 있다. (생략하면 `.value` 접근에서 터진다 — 3회 걸렸다.) */
function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/kids-tshirt",
    title: field("아동용 반팔 티셔츠"),
    brand: field("TestBrand"),
    price: field({ amount: 10000, currency: "KRW" }),
    priceValidity: "VALID",
    sku: field("KIDS-TSHIRT-1"),
    description: field("아동용 반팔 티셔츠입니다."),
    material: field(CANONICAL.material),
    color: field(CANONICAL.color),
    recommendedAge: field(""),
    manufacturer: field(CANONICAL.manufacturer),
    careInstructions: field(CANONICAL.careInstructions),
    options: field([]),
    optionGroups: [{ name: "Size", values: [...SIZE_OPTION_VALUES] }],
    variants: [
      { id: "v-4y", optionValues: { Size: "4Y" }, stockQuantity: 3 },
      { id: "v-6y", optionValues: { Size: "6Y" }, stockQuantity: 2 },
    ],
    images: [
      {
        id: "img-1",
        originalUrl: "https://example.com/images/tshirt.jpg",
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
    countryOfOrigin: field(CANONICAL.countryOfOrigin),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(5),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    ...overrides,
  };
}

function makeListing(product: CanonicalProduct, platform: "smartstore" | "coupang"): ListingModel {
  return {
    platform,
    platformLabel: platform === "smartstore" ? "네이버 스마트스토어" : "쿠팡",
    representativeImage: product.images[0].originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 10000,
    priceIsEstimate: false,
    priceSource: "SELLER_OVERRIDE",
    priceOrigin: "PRODUCT_OVERRIDE",
    options: [],
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  };
}

/* ══ 채널 입력 — 🔴 공용화하지 «않는다». 세 builder 의 추가 입력이 완전히 다르고
   (네이버 필수 9~11개 · 쿠팡 binding · 롯데ON 채널설정 ~30필드) 하나로 섞으면
   「공통 fixture」라는 이름의 거짓말이 된다. 공유하는 것은 상품 fixture 하나다.

   🔴 세 채널에 «같은» 판매자 값을 준다. 처음 측정에서 품질보증·A/S 를 롯데ON 에만
   주고 쿠팡·네이버에는 주지 않아 거짓 FAIL 이 났다 — 입력 비대칭은 채널 결함이
   아니라 fixture 결함이다. */

function naverPayloadFor(product: CanonicalProduct, kids: boolean) {
  return buildNaverProductPayload({
    product,
    listing: makeListing(product, "smartstore"),
    leafCategoryId: LEAF_CATEGORY_ID,
    releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
    refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY" as const,
    sellerDeliveryFee: null,
    returnDeliveryFee: 3000,
    exchangeDeliveryFee: 5000,
    originAreaCode: "00",
    originAreaRequiresContent: false,
    categoryRequiresChildCertification: kids,
    childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
    /* 네이버는 품질보증·A/S 를 상품이 아니라 builder 인자로 받는다. */
    warrantyPolicy: CANONICAL.qualityGuarantee,
    afterServiceDirector: CANONICAL.asContact,
  });
}

const COUPANG_SELLER_CONFIG = {
  ...BLANK_COUPANG_SELLER_CONFIG,
  qualityGuarantee: CANONICAL.qualityGuarantee,
  asContactNumber: AS_PHONE,
};

/* 🔴 실측이 아니라 «실험 조건» 이다(위 머리글 참조). 항목명은 쿠팡 고시 표의
   통상 표기를 쓰고, `required` 는 **판정 근거로 쓰지 않는다.** */
const COUPANG_NOTICE_CATEGORY_NAME = "의류";
const COUPANG_META_UNVERIFIED = {
  attributes: [],
  noticeCategories: [
    {
      noticeCategoryName: COUPANG_NOTICE_CATEGORY_NAME,
      noticeCategoryDetailNames: [
        { noticeCategoryDetailName: "제품 소재", required: "MANDATORY" as const },
        { noticeCategoryDetailName: "색상", required: "MANDATORY" as const },
        { noticeCategoryDetailName: "치수", required: "MANDATORY" as const },
        { noticeCategoryDetailName: "제조자", required: "MANDATORY" as const },
        { noticeCategoryDetailName: "제조국", required: "MANDATORY" as const },
        { noticeCategoryDetailName: "세탁방법 및 취급시 주의사항", required: "MANDATORY" as const },
        { noticeCategoryDetailName: "품질보증기준", required: "MANDATORY" as const },
        { noticeCategoryDetailName: "A/S 책임자와 전화번호", required: "MANDATORY" as const },
      ],
    },
  ],
};

/**
 * 쿠팡 `required` parity 판정 — 🔴 **UNKNOWN 과 «이유» 를 같이 돌려준다**(CPO §3.5).
 *
 * 판정을 `expect` 자리에 흩어 놓으면 「적지 않은 것」과 「UNKNOWN 으로 닫은 것」이
 * 구별되지 않는다. 한 함수가 들고 있으면 보고서가 그것을 그대로 인용할 수 있다.
 *
 * 🔴 이 함수는 메타 스텁의 `required` 값을 «읽지 않는다». 읽으면 그 순간
 *    「근거 없는 값」이 판정 근거가 된다.
 */
function coupangRequiredVerdict(): { verdict: "UNKNOWN"; reason: string } {
  return {
    verdict: "UNKNOWN",
    reason:
      "쿠팡 category-meta 실제 응답 샘플이 이 저장소에 0건이다. 게다가 builder 가 " +
      'required === "MANDATORY" 로 항목을 걸러내므로(coupang/build-payload.ts:1521), ' +
      "모르는 것은 플래그 하나가 아니라 고시 항목 집합 자체다.",
  };
}

function coupangPayloadFor(product: CanonicalProduct) {
  return buildCoupangPayload(product, makeListing(product, "coupang"), {
    binding: {},
    sellerConfig: COUPANG_SELLER_CONFIG,
    categoryMeta: COUPANG_META_UNVERIFIED,
  });
}

/* 🔴 `noticeArticles` 를 손으로 적지 않는다 — 운영 경로(`resolveLotteOnNotice`)가
   만든 결과를 그대로 채널 설정에 넣는다. facts 매핑 축은 운영 호출부
   (apps/admin/src/app/api/lotteon/_lib/build-context.ts)와 같다.
   🔴 `sellerAsCompanyName` 은 운영에 «아직 출처가 없는» 칸이다. 여기서 채우는
      것은 A/S 값 라우팅을 재기 위한 것이고, 실제 운영에서는 비어서 롯데ON 0090 이
      BLOCKED 된다 — 그 사실을 이 측정이 덮지 않는다(§Known Unknowns). */
function lotteOnChannelFor(product: CanonicalProduct, noticeItemCode: "01" | "23"): LotteOnChannelConfig {
  const resolution = resolveLotteOnNotice(noticeItemCode, {
    color: product.color.value,
    material: product.material.value,
    countryOfOrigin: product.countryOfOrigin.value,
    sizeValues: product.optionGroups
      .filter((group) => /size|사이즈/i.test(group.name))
      .flatMap((group) => group.values),
    weight: product.weight.value,
    careInstructions: product.careInstructions.value,
    manufacturer: product.manufacturer.value,
    importer: product.importer.value,
    itemName: product.itemName.value,
    modelName: product.modelName.value,
    recommendedAge: product.recommendedAge.value,
    kcCertificationNumber: product.childCertification.value?.certificationNumber ?? null,
    safetyTarget: null,
    sellerQualityGuarantee: CANONICAL.qualityGuarantee,
    sellerAsContactNumber: AS_COMPANY,
    sellerAsCompanyName: AS_COMPANY,
    sellerAsPhoneNumber: AS_PHONE,
  });

  /* 🔴 품목을 모르면 항목을 지어내지 않는다 — 그 상태로 비교하면 빈 배열을
     「일치」로 읽는다. */
  expect(resolution.schemaKnown).toBe(true);

  return {
    ...BLANK_LOTTEON_CHANNEL_CONFIG,
    ...buildLotteOnSalePeriod(new Date("2026-09-14T00:00:00Z")),
    trGrpCd: "SR",
    trNo: "LO10000",
    standardCategoryNo: "BC63080300",
    displayCategories: [{ mallCd: "LTON", lfDcatNo: "FC11130203" }],
    originCode: "KR",
    taxTypeCode: "01",
    noticeItemCode,
    noticeArticles: resolution.articles,
    outboundPlaceNo: "115",
    returnPlaceNo: "115",
    deliveryCostPolicyNo: "335",
    deliveryRegionGroupCode: "GN101",
  };
}

function lotteOnPayloadFor(product: CanonicalProduct, noticeItemCode: "01" | "23") {
  return buildLotteOnPayload({
    product,
    channel: lotteOnChannelFor(product, noticeItemCode),
    detailHtml: "<p>상세</p>",
  });
}

/* ══ semantic key → 채널 칸 (🔴 손으로 쓴 독립 리터럴 · 공통 모델에서 끌어오지 않는다) */

type SemanticKey =
  | "material"
  | "color"
  | "size"
  | "manufacturer"
  | "countryOfOrigin"
  | "careInstructions"
  | "qualityGuarantee"
  | "asContact";

/** 네이버 고시 칸 이름. `countryOfOrigin` 은 네이버 고시에 칸이 «없다»(별도 축). */
const NAVER_SLOT: Partial<Record<SemanticKey, string>> = {
  material: "material",
  color: "color",
  size: "size",
  manufacturer: "manufacturer",
  careInstructions: "caution",
  qualityGuarantee: "warrantyPolicy",
  asContact: "afterServiceDirector",
};

const COUPANG_SLOT: Partial<Record<SemanticKey, string>> = {
  material: "제품 소재",
  color: "색상",
  size: "치수",
  manufacturer: "제조자",
  countryOfOrigin: "제조국",
  careInstructions: "세탁방법 및 취급시 주의사항",
  qualityGuarantee: "품질보증기준",
  asContact: "A/S 책임자와 전화번호",
};

/** 롯데ON 품목 01(의류)·23(유아동의류)에서 그 의미를 담는 `pdArtlCd`. */
const LOTTEON_SLOT: Record<"01" | "23", Partial<Record<SemanticKey, string>>> = {
  "01": {
    material: "0010",
    color: "0020",
    size: "0030",
    manufacturer: "0070",
    countryOfOrigin: "0060",
    careInstructions: "0050",
    qualityGuarantee: "0080",
    asContact: "0090",
  },
  "23": {
    material: "0410",
    color: "0020",
    size: "0780",
    manufacturer: "0070",
    countryOfOrigin: "0060",
    careInstructions: "0800",
    qualityGuarantee: "0080",
    asContact: "0090",
  },
};

type NoticeValues = Partial<Record<SemanticKey, string | undefined>>;

function extractNaver(payload: ReturnType<typeof naverPayloadFor>): NoticeValues {
  const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice as unknown as
    | Record<string, unknown>
    | undefined;
  const bucket = (notice?.kids ?? notice?.wear) as Record<string, string | undefined> | undefined;
  const out: NoticeValues = {};
  for (const [semantic, slot] of Object.entries(NAVER_SLOT) as [SemanticKey, string][]) {
    out[semantic] = bucket?.[slot];
  }
  return out;
}

function extractCoupang(payload: ReturnType<typeof coupangPayloadFor>): NoticeValues {
  const notices = payload.items[0]?.notices ?? [];
  const out: NoticeValues = {};
  for (const [semantic, slot] of Object.entries(COUPANG_SLOT) as [SemanticKey, string][]) {
    out[semantic] = notices.find((n) => n.noticeCategoryDetailName === slot)?.content;
  }
  return out;
}

function extractLotteOn(
  payload: ReturnType<typeof lotteOnPayloadFor>,
  noticeItemCode: "01" | "23",
): NoticeValues {
  const articles = payload.spdLst[0]?.pdItmsInfo?.pdItmsArtlLst ?? [];
  const out: NoticeValues = {};
  for (const [semantic, code] of Object.entries(LOTTEON_SLOT[noticeItemCode]) as [
    SemanticKey,
    string,
  ][]) {
    out[semantic] = articles.find((a) => a.pdArtlCd === code)?.pdArtlCnts;
  }
  return out;
}

/**
 * 세 채널의 추출값을 canonical 기대값과 대조한다.
 *
 * 🔴 「키가 없다」와 「값이 다르다」를 갈라 적는다 — 둘을 뭉치면 칸이 통째로 빠진
 *    경우를 「값 불일치」로 잘못 읽는다.
 */
function mismatchesAgainstCanonical(
  channel: string,
  extracted: NoticeValues,
  keys: readonly SemanticKey[],
): string[] {
  const problems: string[] = [];
  for (const key of keys) {
    const actual = extracted[key];
    const expected = CANONICAL[key];
    if (actual === undefined) {
      problems.push(`${channel}.${key}: 칸이 없다(expected ${JSON.stringify(expected)})`);
      continue;
    }
    if (actual !== expected) {
      problems.push(
        `${channel}.${key}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`,
      );
    }
  }
  return problems;
}

/* 🔴 세 채널 «모두» 가 같은 의미로 담을 수 있다고 실측된 의미들.
   `countryOfOrigin` 은 제외 — 네이버 고시에는 그 칸이 없다(별도 축). 구조 차이를
   값 불일치로 적으면 FAIL 의 뜻이 흐려진다. */
const PARITY_KEYS = [
  "material",
  "color",
  "manufacturer",
  "careInstructions",
  "qualityGuarantee",
] as const satisfies readonly SemanticKey[];

describe("② 3-Commerce Semantic Notice Parity — 실제 builder payload 기준", () => {
  describe.each([
    ["APPAREL / Naver WEAR · LotteON 01", false, "01"],
    ["KIDS_APPAREL / Naver KIDS · LotteON 23", true, "23"],
  ] as const)("%s", (_label, kids, itemCode) => {
    it("세 payload 가 실제 builder 에서 «각각» 만들어진다 — mock 없음", () => {
      const product = makeProduct();

      const naver = naverPayloadFor(product, kids);
      const coupang = coupangPayloadFor(product);
      const lotteon = lotteOnPayloadFor(product, itemCode);

      /* 고시 구획이 실제로 «있는» 자리에서 나왔는지 — 경로가 틀리면 아래 비교가
         undefined 끼리 맞아 조용히 통과한다. 실제로 착수점 문서의 롯데ON 경로가
         한 단계 틀려 있었고(`spdLst[].pdItmsArtlLst`), 그대로 썼다면 그렇게 됐다. */
      expect(naver.originProduct.detailAttribute?.productInfoProvidedNotice).toBeDefined();
      expect(coupang.items[0].notices.length).toBeGreaterThan(0);
      expect(lotteon.spdLst[0].pdItmsInfo.pdItmsArtlLst.length).toBeGreaterThan(0);
    });

    it("🟢 공통 의미 5개가 세 채널에서 «같은 값» 으로 보존된다", () => {
      const product = makeProduct();
      const naver = extractNaver(naverPayloadFor(product, kids));
      const coupang = extractCoupang(coupangPayloadFor(product));
      const lotteon = extractLotteOn(lotteOnPayloadFor(product, itemCode), itemCode);

      expect([
        ...mismatchesAgainstCanonical("naver", naver, PARITY_KEYS),
        ...mismatchesAgainstCanonical("coupang", coupang, PARITY_KEYS),
        ...mismatchesAgainstCanonical("lotteon", lotteon, PARITY_KEYS),
      ]).toEqual([]);
    });

    it("원산지는 네이버 고시에 칸이 «없고» 나머지 둘은 원문 그대로 싣는다 — 정규화하지 않는다", () => {
      const product = makeProduct();
      expect(extractNaver(naverPayloadFor(product, kids)).countryOfOrigin).toBeUndefined();
      expect(extractCoupang(coupangPayloadFor(product)).countryOfOrigin).toBe(
        CANONICAL.countryOfOrigin,
      );
      expect(extractLotteOn(lotteOnPayloadFor(product, itemCode), itemCode).countryOfOrigin).toBe(
        CANONICAL.countryOfOrigin,
      );
    });

    /* ══════════════════════════════════════════════════════════════════════════
       🔴 아래 둘은 **parity FAIL 을 현재 동작으로 고정한 것** 이다.
       통과한다는 뜻은 「문제가 없다」가 아니라 「문제가 아직 그대로 있다」다.
       고치면 이 테스트가 깨져야 한다 — 그때 ②의 판정을 다시 적는다.
       ══════════════════════════════════════════════════════════════════════ */

    it("🔴 FAIL 고정 — 쿠팡 「치수」에는 값이 아니라 placeholder 가 나간다", () => {
      const product = makeProduct();
      const naver = extractNaver(naverPayloadFor(product, kids));
      const coupang = extractCoupang(coupangPayloadFor(product));
      const lotteon = extractLotteOn(lotteOnPayloadFor(product, itemCode), itemCode);

      /* 두 채널은 실제 사이즈 옵션을 싣는다. */
      expect(naver.size).toBe(CANONICAL.size);
      expect(lotteon.size).toBe(CANONICAL.size);

      /* 🔴 쿠팡은 못 싣는다 — `matchProductFieldDetailed`(coupang/build-payload.ts:1205)
         에 size 축 규칙이 «없어서» 사다리 끝의 기본 문구로 떨어진다. 값이 있는데
         placeholder 가 나가는 것이라 「값 누락」이다. */
      expect(coupang.size).not.toBe(CANONICAL.size);
      expect(coupang.size).toBe("전체 상품 상세페이지 참조");
    });

    it("🔴 FAIL 고정 — 쿠팡 A/S 는 «전화번호만» 나가고 업체명이 빠진다", () => {
      const product = makeProduct();
      const naver = extractNaver(naverPayloadFor(product, kids));
      const coupang = extractCoupang(coupangPayloadFor(product));
      const lotteon = extractLotteOn(lotteOnPayloadFor(product, itemCode), itemCode);

      expect(naver.asContact).toBe(CANONICAL.asContact);
      expect(lotteon.asContact).toBe(CANONICAL.asContact);

      /* 🔴 `KNOWN_NOTICE_VALUES["A/S 책임자와 전화번호"] = context.contactNumber`
         (coupang/build-payload.ts:1516) — 전화번호 한 조각만 안다. 고시 항목명이
         «책임자와 전화번호» 라 업체명이 빠진 것은 부분 신고다. */
      expect(coupang.asContact).toBe(AS_PHONE);
      expect(coupang.asContact).not.toContain(AS_COMPANY);
    });
  });

  /* ══ 🔴 Negative — 비교가 실제 차이를 «감지하는가» ════════════════════════ */

  describe("🔴 Negative — 한 채널의 의미 하나를 다르게 만들면 반드시 잡힌다", () => {
    it("재질을 한 채널만 다른 값으로 빌드하면 mismatch 가 보고된다", () => {
      const normal = makeProduct();
      /* 쿠팡 쪽만 다른 재질로 빌드한다 — 같은 상품이어야 하는데 달라진 상황. */
      const tampered = makeProduct({ material: field("폴리에스터 100%") });

      const naver = extractNaver(naverPayloadFor(normal, false));
      const coupang = extractCoupang(coupangPayloadFor(tampered));
      const lotteon = extractLotteOn(lotteOnPayloadFor(normal, "01"), "01");

      const problems = [
        ...mismatchesAgainstCanonical("naver", naver, PARITY_KEYS),
        ...mismatchesAgainstCanonical("coupang", coupang, PARITY_KEYS),
        ...mismatchesAgainstCanonical("lotteon", lotteon, PARITY_KEYS),
      ];

      expect(problems).not.toEqual([]);
      expect(problems.some((p) => p.startsWith("coupang.material:"))).toBe(true);
      /* 🔴 건드리지 않은 두 채널은 조용해야 한다 — 전부 FAIL 로 물들면 감지력이
         아니라 노이즈다. */
      expect(problems.some((p) => p.startsWith("naver."))).toBe(false);
      expect(problems.some((p) => p.startsWith("lotteon."))).toBe(false);
    });

    it("칸이 통째로 빠진 경우와 값이 다른 경우를 갈라 보고한다", () => {
      expect(mismatchesAgainstCanonical("x", {}, ["material"])).toEqual([
        `x.material: 칸이 없다(expected ${JSON.stringify(CANONICAL.material)})`,
      ]);
      expect(mismatchesAgainstCanonical("x", { material: "다른값" }, ["material"])).toEqual([
        `x.material: "다른값" ≠ ${JSON.stringify(CANONICAL.material)}`,
      ]);
    });

    it("매핑이 틀리면 잡힌다 — 색상 칸에서 재질을 찾으면 mismatch 다", () => {
      const product = makeProduct();
      const lotteon = extractLotteOn(lotteOnPayloadFor(product, "01"), "01");
      /* 0020(색상)에서 재질을 기대하면 틀려야 한다 — 매핑표가 의미를 실제로
         구별하고 있다는 뜻이다(전부 같은 값이면 이 테스트가 통과할 수 없다). */
      expect(lotteon.color).not.toBe(CANONICAL.material);
    });
  });

  /* ══ 🔴 쿠팡 required — UNKNOWN 유지 ══════════════════════════════════════ */

  describe("🔴 쿠팡 required 는 UNKNOWN 이다 — 이 파일은 그것을 근거로 쓰지 않는다", () => {
    it("판정은 PASS 가 아니라 UNKNOWN 이고, 이유를 같이 들고 있다", () => {
      const { verdict, reason } = coupangRequiredVerdict();
      expect(verdict).toBe("UNKNOWN");
      /* 🔴 「UNKNOWN 이라고만 적혀 있고 이유가 없는」 상태를 막는다. */
      expect(reason).toContain("0건");
      expect(reason).toContain("항목 집합");
      /* 🔴 그리고 이 파일 어디서도 UNKNOWN 을 PASS 로 바꿔 적지 않는다. */
      expect(verdict).not.toBe("PASS");
    });

    it("메타가 없으면 쿠팡 고시는 0건이다 — 「고시가 있다」는 메타 조회에 달려 있다", () => {
      const product = makeProduct();
      const noMeta = buildCoupangPayload(product, makeListing(product, "coupang"), {
        binding: {},
        sellerConfig: COUPANG_SELLER_CONFIG,
        categoryMeta: null,
      });
      expect(noMeta.items[0].notices).toEqual([]);
    });

    it("항목 집합이 required 플래그에 달려 있다 — 그래서 집합 자체가 UNKNOWN 이다", () => {
      const product = makeProduct();
      /* 같은 항목을 OPTIONAL 로 바꾸면 payload 에서 «사라진다»
         (coupang/build-payload.ts:1521 이 MANDATORY 만 통과시킨다).
         🔴 실제 쿠팡이 무엇을 MANDATORY 로 주는지 이 저장소에 샘플이 0건이므로,
            아래는 required 의 «값» 에 대한 주장이 아니라 「집합이 그 플래그에
            의존한다」는 구조 사실이다. */
      const optionalized = buildCoupangPayload(product, makeListing(product, "coupang"), {
        binding: {},
        sellerConfig: COUPANG_SELLER_CONFIG,
        categoryMeta: {
          attributes: [],
          noticeCategories: [
            {
              noticeCategoryName: COUPANG_NOTICE_CATEGORY_NAME,
              noticeCategoryDetailNames: [
                { noticeCategoryDetailName: "제품 소재", required: "OPTIONAL" as const },
              ],
            },
          ],
        },
      });
      expect(optionalized.items[0].notices).toEqual([]);
    });
  });
});
