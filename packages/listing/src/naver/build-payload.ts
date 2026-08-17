import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import { convertToKrw } from "@commerce/pricing";
import { assembleContentsFromBlocks, BLANK_COUPANG_SELLER_CONFIG } from "../coupang/build-payload";
import type { CoupangDescriptionTemplate, CoupangSellerConfig, DetailPageBlock } from "../coupang/build-payload";
import type {
  NaverClaimDeliveryInfo,
  NaverImageRef,
  NaverOptionCombination,
  NaverOptionCombinationGroupNames,
  NaverProductRegistrationPayload,
} from "./types";
import { resolveNoticeFieldValue } from "../notice/reference-eligibility";

/**
 * Sprint N-2.6 — CartPilot canonical product → Naver v2 payload 변환.
 *
 * 기존 build-payload.ts(smartstore DRY_RUN용, packages/listing/src/smartstore/)와
 * 완전히 별개다 — 그 파일은 자체 주석에 "실제 네이버 API 요청 바디를 그대로
 * 흉내내지 않는다"고 명시돼 있어서 실제 스키마 변환에는 재사용할 수 없었다
 * (N-2.1 조사 결과). 이 파일이 실제 스키마를 대상으로 하는 첫 구현이다.
 *
 * N-2.8에서 optionCombinations/originAreaInfo 필드명을 채우기 시작했다 —
 * 필드명 자체는 공식 OpenAPI 스펙으로 확인됨(N-3.6 정정: 과거 "GitHub #241
 * 원문 코드 예제로 확인"이라고 적었던 근거는 사실 한 사용자의 잘못된 요청을
 * 메인테이너가 지적한 스레드였다 — 공식 확인이 아니었다. 다행히 필드명/구조는
 * N-3.3/N-3.4에서 공식 OpenAPI 스펙으로 별도 재확인돼 있어 값 자체는
 * 문제없었다). N-3.4에서 originAreaCode enum은 GET /v1/product-origin-areas
 * 실측으로 100% 확인됐다(더 이상 BLOCKED 아님) — 다만 optionCombinations.price의
 * 의미(절대가/추가금액)는 N-3.6 재조사에서도 공식 근거를 찾지 못해 여전히
 * 미확인이라 validate-payload.ts가 항상 BLOCKED로 남긴다(추측 값을 신뢰해서
 * 등록에 쓰지 말라는 신호). 택배사 코드(deliveryCompany enum)도 N-3.6에서
 * 배송 관련 스키마(묶음배송/희망일배송/반품택배사)를 전부 재확인했지만 출고
 * 택배사 조회 API 자체가 없어서(N-2.5) 여전히 채우지 않는다.
 */

export interface NaverPayloadInput {
  product: CanonicalProduct;
  listing: ListingModel;
  /** N-2.4 확인 — 리프 카테고리 ID(예: "50000535"). */
  leafCategoryId: string;
  /** N-2.5 확인 — 판매자 주소록(addressbooks-for-page)의 addressType=RELEASE
   * 항목 addressBookNo. N-3.3에서 claimDeliveryInfo.shippingAddressId(출고지
   * 주소록 번호)가 이 값을 그대로 가리킨다는 걸 공식 OpenAPI 스펙으로 확인했다
   * (더 이상 가정이 아니다). */
  releaseAddressBookNo: number | null;
  /** N-2.5 확인 — addressType=REFUND_OR_EXCHANGE 항목 addressBookNo.
   * claimDeliveryInfo.returnAddressId(반품/교환지 주소록 번호)로 확인됨. */
  refundAddressBookNo: number | null;
  /** N-3.3 확인 — GET /v2/product-delivery-info/return-delivery-companies로
   * 조회한 판매자의 실제 등록 반품 택배사 중 우선순위가 가장 높은 것(보통
   * PRIMARY). 판매자가 반품 택배사를 하나도 등록 안 했으면 null(추측 금지 —
   * "PRIMARY"라는 값 자체는 확인됐지만 실제로 그 택배사가 존재하는지는
   * 이 값으로 판단한다). */
  primaryReturnDeliveryCompanyPriorityType: string | null;
  /** N-3.3 — Naver 전용 설정이 따로 없어 Coupang용 SellerProfile.
   * returnDeliveryCharge(판매자의 실제 반품 배송비 정책)를 재사용한다. */
  returnDeliveryFee: number | null;
  /** N-3.3 — SellerProfile.exchangeDeliveryCharge 재사용. */
  exchangeDeliveryFee: number | null;
  /** N-2.4 확인 — 카테고리 detail의 certificationInfos 중 kindTypes에
   * CHILD_CERTIFICATION이 포함된 항목의 id. N-3.29부터 실제 인증서 정보
   * (번호/업체명/일자)는 product.childCertification에 판매자가 직접 입력한
   * 값이 있으면 그대로 payload에 채운다 — 값이 없으면 이 id만으로 자리표시자를
   * 만들고, validate-payload.ts가 인증 필요 카테고리인데 실제 값이 없으면
   * BLOCKED 처리한다(임의 값 생성은 여전히 금지). */
  childCertificationInfoId: number | null;
  /** N-2.7 추가 — 카테고리 detail의 exceptionalCategories에 CHILD_CERTIFICATION이
   * 있는지(호출부 판단, 이 함수는 카테고리 API를 다시 호출하지 않는다). 상품정보
   * 제공고시는 인증서 실제 보유 여부(childCertificationInfoId)와 무관하게 항상
   * 필요한 별개의 고시 의무라서, 이 값만으로 KIDS/WEAR 타입을 정하고 고시 필드는
   * 항상 채운다 — N-2.6에서는 이 둘을 하나로 묶어서 인증 카탈로그 id가 없으면
   * 고시 섹션 전체가 사라졌는데(Preview에서 항상 보여야 하는 섹션이 사라지는
   * 버그), 실제로는 "고시 의무"와 "인증서 보유"가 서로 다른 개념이라 분리한다. */
  categoryRequiresChildCertification: boolean;
  /** N-3.4 확인 — GET /v1/product-origin-areas(535개 실제 코드)로 매칭한 값.
   * resolveNaverOriginArea가 만든 코드를 그대로 받는다(이 함수는 매칭을
   * 다시 하지 않는다 — Resolver → Payload 단방향 원칙). null이면 원산지
   * 텍스트 자체가 없었다는 뜻. */
  originAreaCode: string | null;
  /** N-3.4 — originAreaCode가 04(직접입력)로 폴백된 경우에만 true. 이때만
   * content가 스펙상 필수라서 이 값이 true일 때만 content를 채운다. */
  originAreaRequiresContent: boolean;
  /** N-3.6(개정 Part A) — 출고 택배사 조회 API는 여전히 없다(확인 유지).
   * SellerProfile.naverDeliveryCompanyCode에 판매자가 직접 입력한 값이 있으면
   * 그 값을 그대로 채운다(Coupang deliveryCompanyCode와 같은 수동 입력 패턴) —
   * 없으면(undefined/null) 지금까지처럼 비운다. 기존 테스트/호출부가 이 필드를
   * 몰라도 되도록 optional로 둔다. */
  deliveryCompany?: string | null;
  /** N-3.13 Part E-12 — 공식 OpenAPI 스펙(ExternalApiWearInfoProvidedNoticeVo.product/
   * ExternalApiKidsInfoProvidedNoticeVo.product) required 배열에서 warrantyPolicy
   * (품질 보증 기준)가 확인됐다. Naver 전용 입력 필드가 따로 없어 Coupang용으로
   * 이미 있는 SellerProfile.qualityGuarantee(판매자 정보 탭 "품질보증기준")를
   * 재사용한다 — returnDeliveryFee/exchangeDeliveryFee와 같은 패턴, 새 DB 컬럼
   * 만들지 않는다. */
  warrantyPolicy?: string | null;
  /** N-3.13 Part E-12 — 같은 스펙에서 확인된 afterServiceDirector(A/S 책임자와
   * 전화번호). SellerProfile.asContactNumber(판매자 정보 탭 "A/S 연락처") 재사용. */
  afterServiceDirector?: string | null;
  /** N-3.13 Part J — Detail Page Editor(2026-08-04)가 만드는 블록 순서. 있으면
   * 이 순서로 상세페이지를 조립한다(assembleContentsFromBlocks — Coupang과
   * 완전히 같은 블록 해석 로직을 재사용한다, 플랫폼마다 규칙이 갈라지면 안
   * 된다). 없으면(에디터를 한 번도 안 연 세션) 지금까지처럼 listing.description을
   * 그대로 쓴다 — 회귀 없음이 목적이다. */
  detailBlocks?: DetailPageBlock[];
  /** N-3.13 Part J — 안내 문구 템플릿. Naver 전용 템플릿이 따로 없어 Coupang용
   * DescriptionTemplate을 그대로 재사용한다(SellerProfile 필드 재사용과 같은
   * 패턴 — 판매자가 같은 배송/반품 안내를 두 번 입력하지 않게 한다). */
  descriptionTemplate?: CoupangDescriptionTemplate | null;
  /** N-3.13 Part J — 상세페이지 공통이미지(상단/하단) ON/OFF·URL. SellerProfile
   * 재사용(Coupang과 동일 값 — 같은 판매자의 같은 정책이라 플랫폼별로 따로
   * 관리하지 않는다). */
  commonImages?: Pick<
    CoupangSellerConfig,
    "topCommonImageUrl" | "topCommonImageEnabled" | "bottomCommonImageUrl" | "bottomCommonImageEnabled"
  >;
  /** N-3.13 Part J — 브랜드 소개(BrandProfile.brandIntro), Coupang과 동일 소스. */
  brandIntro?: string | null;
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** N-3.13 Part J — assembleContentsFromBlocks(Coupang/Naver 공통, 블록 →
 * TEXT/IMAGE 순서 배열)가 만든 결과를 Naver의 detailContent(공식 스펙 "상품
 * 상세 정보", 단일 문자열 필드)로 합친다. Coupang은 그 배열 자체가 최종
 * payload 형태지만 Naver는 한 문자열이라 여기서만 변환한다 — 블록을 실제로
 * 해석하는 로직(템플릿 섹션/공통이미지 on-off/사이즈표 분리 등)은 두 번
 * 만들지 않고 그대로 재사용한다. */
export function assembleNaverDetailContent(
  blocks: DetailPageBlock[],
  ctx: {
    aiDescription: string;
    template: CoupangDescriptionTemplate | null | undefined;
    commonImages: Pick<
      CoupangSellerConfig,
      "topCommonImageUrl" | "topCommonImageEnabled" | "bottomCommonImageUrl" | "bottomCommonImageEnabled"
    >;
    productImageUrls: string[];
    sizeChartImageUrls: string[];
    brandIntro?: string | null;
  },
): string {
  const contents = assembleContentsFromBlocks(blocks, {
    aiDescription: ctx.aiDescription,
    template: ctx.template,
    sellerConfig: { ...BLANK_COUPANG_SELLER_CONFIG, ...ctx.commonImages },
    productImageUrls: ctx.productImageUrls,
    sizeChartImageUrls: ctx.sizeChartImageUrls,
    brandIntro: ctx.brandIntro,
  });

  const parts: string[] = [];
  for (const content of contents) {
    for (const detail of content.contentDetails) {
      if (detail.detailType === "TEXT") {
        parts.push(`<p>${escapeHtmlText(detail.content).replace(/\n/g, "<br>")}</p>`);
      } else {
        parts.push(`<img src="${detail.content}" style="max-width:100%;">`);
      }
    }
  }
  return parts.join("\n");
}

/** N-2.8 — 옵션 조합(optionCombinations) 필드명은 공식 OpenAPI 스펙으로
 * 확인됐다(id/optionName1-4/stockQuantity/price/sellerManagerCode/
 * usable, ExternalApiOptionCombinationVo.product). N-3.47(CPO 지시)에서
 * price 필드의 의미(절대 판매가 vs salePrice 대비 추가금액)가 Naver 공식
 * 계정 답변(GitHub Discussion #2312, 2025-02-17, packages/listing/src/naver/
 * types.ts의 NaverOptionCombination 주석 참고)으로 확정됐다 — "옵션가"는
 * salePrice 대비 추가금액(delta)이다. 아래 계산("price = variant.price가
 * 있으면 salePrice와의 차액, 없으면 0")은 이 확정된 의미와 정확히 일치한다.
 *
 * N-3.4 — id 필드는 공식 OpenAPI 스펙으로 "옵션 ID 입력 시 기존 옵션 수정"임이
 * 확인됐다(ExternalApiOptionCombinationVo.product). N-2.8까지는 여기에
 * variant.sku를 넣고 있었는데, 이건 실제로는 존재하지 않는(신규 상품이니
 * 당연히) "기존 네이버 옵션 ID"를 지어내는 것과 같은 버그였다 — 신규 등록
 * 흐름에서는 id를 절대 채우지 않는다. SKU는 부작용 없는 sellerManagerCode
 * (판매자 관리 코드)로 옮긴다. optionName1..4는 product.optionGroups
 * 순서대로 variant.optionValues 값을 채운다. */
function buildOptionCombinations(product: CanonicalProduct, salePrice: number): NaverOptionCombination[] {
  const groupNames = product.optionGroups.map((g) => g.name);
  return product.variants.map((variant) => {
    const values = groupNames.map((name) => variant.optionValues[name] ?? "");
    // N-3.18(CPO 지시: "variant 가격 Provenance/우선순위 재검증") — variant.price는
    // 원본 사이트 통화(예: USD) 그대로다. salePrice(KRW)와 통화 단위를 맞추지
    // 않고 그냥 빼면(옛날 코드: variant.price.amount - salePrice) 숫자 단위가
    // 안 맞는 값이 나온다(예: 27.20 - 64500). Coupang의 buildCoupangItem이 이미
    // convertToKrw로 원화 환산 후 계산하는 것과 같은 방식으로 맞춘다. N-3.47에서
    // 이 delta 계산 자체가 Naver 공식 답변과 일치함이 확인됐다(위 함수 주석).
    const priceDelta = variant.price
      ? convertToKrw(variant.price.amount, variant.price.currency).amountKrw - salePrice
      : 0;
    const combo: NaverOptionCombination = {
      stockQuantity: variant.stockQuantity ?? product.stockQuantity.value ?? 0,
      price: priceDelta,
      usable: true,
    };
    if (variant.sku) combo.sellerManagerCode = variant.sku;
    if (values[0]) combo.optionName1 = values[0];
    if (values[1]) combo.optionName2 = values[1];
    if (values[2]) combo.optionName3 = values[2];
    if (values[3]) combo.optionName4 = values[3];
    return combo;
  });
}

/** N-3.49(실제 등록 시도로 확인, 2026-08-17) — optionCombinationGroupNames는
 * 배열이 아니라 optionGroupName1..4 키를 가진 객체다(types.ts의
 * NaverOptionCombinationGroupNames 주석 참고 — 실제 HTTP 400으로 발견). 최대
 * 3개까지만 허용된다는 스마트스토어 정책(공식 커뮤니티 확인)이라 4번째부터는
 * 채우지 않는다. */
function buildOptionCombinationGroupNames(
  optionGroups: CanonicalProduct["optionGroups"],
): NaverOptionCombinationGroupNames {
  const names = optionGroups.map((g) => g.name);
  const result: NaverOptionCombinationGroupNames = {};
  if (names[0]) result.optionGroupName1 = names[0];
  if (names[1]) result.optionGroupName2 = names[1];
  if (names[2]) result.optionGroupName3 = names[2];
  return result;
}

function toImageRef(url: string): NaverImageRef {
  return { url };
}

/**
 * N-3.32(CPO 지시) — Shopify는 매장이 옵션을 전혀 안 쓰는 진짜 단일 SKU
 * 상품도 원본 JSON에 항상 `{name:"Title", values:["Default Title"]}` 하나를
 * 채워서 준다(Shopify 자체 스펙). shopify-product-json.ts는 이걸 이미
 * "옵션 없음"으로 취급해 variants는 비우지만(hasRealOptions 로컬 판정),
 * optionGroups 배열 자체는 그대로 통과시킨다 — 그래서 validate-payload.ts가
 * `optionGroups.length > 0`만 보면 이 placeholder 하나 때문에 실제 옵션이
 * 없는 상품도 무조건 optionInfo BLOCKED로 오판했다(N-3.31에서 발견).
 *
 * build-payload.ts와 validate-payload.ts가 "옵션 있음"을 서로 다른 기준으로
 * 판정하지 않도록 이 함수 하나로 통일한다. 판정 기준:
 *   - optionGroups가 2개 이상이거나, 1개뿐이어도 값이 2개 이상이면 → 실제 옵션
 *   - variants에 실제 레코드가 있으면(값이 비어도 레코드 자체가 있으면) → 실제
 *     옵션(원본 파싱이 일부만 성공한 경우까지 "옵션 없음"으로 지워버리지 않기
 *     위함 — N-3.4 "옵션값 비어있음" 케이스와 충돌하면 안 된다)
 *   - 그 외(단일 그룹+단일 값, variants 없음)만 "옵션 없음"
 * variants.length > 0을 안전장치로 두는 이유: `{사이즈:["100"]}`처럼 겉모양은
 * placeholder와 같아도(그룹 1개, 값 1개) 실제 variant 레코드(SKU/재고 포함)가
 * 있으면 그건 진짜 옵션 상품이지 Shopify의 무옵션 기본상태가 아니다 — 이 둘을
 * 구조만 보고 섞으면 안 된다는 게 이번 작업의 핵심 전제(CPO 지시 Case C).
 */
export function hasRealProductOptions(product: CanonicalProduct): boolean {
  const hasMultipleGroupsOrValues =
    product.optionGroups.length > 1 ||
    (product.optionGroups.length === 1 && product.optionGroups[0].values.length > 1);
  return hasMultipleGroupsOrValues || product.variants.length > 0;
}

/**
 * N-3.13 R2 Part 9 — productInfoProvidedNotice.size는 CartPilot에 별도 입력
 * 경로가 없어 항상 MISSING이었다. product.optionGroups에 이미 실제 SIZE 옵션
 * 값이 있으면(예: "Size": ["4-5 Years", "6-7 Years"]) 이걸 재사용한다 — 새
 * 입력 UI를 만들지 않는다(CPO 지시). SIZE 옵션이 없으면 undefined를 반환해서
 * validate-payload.ts가 지금처럼 MISSING으로 남기게 한다(임의값 금지).
 */
export function resolveSizeFromOptions(product: CanonicalProduct): string | undefined {
  const sizeGroup = product.optionGroups.find((g) => /size|사이즈/i.test(g.name));
  if (!sizeGroup || sizeGroup.values.length === 0) return undefined;
  return sizeGroup.values.join(", ");
}

/**
 * DRY_RUN 전용 — 실제 POST를 호출하지 않는다. 확인 안 된 필드(deliveryCompany,
 * originAreaInfo, optionCombinations 등)는 채우지 않고 undefined로 남긴다 —
 * validate-payload.ts가 이걸 근거로 BLOCKED 사유를 만든다.
 */
export function buildNaverProductPayload(input: NaverPayloadInput): NaverProductRegistrationPayload {
  const {
    product,
    listing,
    leafCategoryId,
    releaseAddressBookNo,
    refundAddressBookNo,
    primaryReturnDeliveryCompanyPriorityType,
    returnDeliveryFee,
    exchangeDeliveryFee,
    childCertificationInfoId,
    categoryRequiresChildCertification,
    originAreaCode,
    originAreaRequiresContent,
    deliveryCompany,
    warrantyPolicy,
    afterServiceDirector,
    detailBlocks,
    descriptionTemplate,
    commonImages,
    brandIntro,
  } = input;

  const representativeUrl = listing.representativeImage;
  const optionalUrls = listing.additionalImages;

  // N-3.13 Part J — detailBlocks가 있으면(에디터를 연 세션) 그 순서로 조립한
  // HTML을, 없으면(회귀 방지) 지금까지처럼 listing.description을 그대로 쓴다.
  const productImageUrls = product.images
    .filter((img) => img.useInDescription && img.classification !== "SIZE_CHART")
    .map((img) => getSelectedImageUrl(img));
  const sizeChartImageUrls = product.images
    .filter((img) => img.useInDescription && img.classification === "SIZE_CHART")
    .map((img) => getSelectedImageUrl(img));
  const detailContent =
    detailBlocks && detailBlocks.length > 0
      ? assembleNaverDetailContent(detailBlocks, {
          aiDescription: listing.description,
          template: descriptionTemplate,
          commonImages: commonImages ?? {
            topCommonImageUrl: null,
            topCommonImageEnabled: false,
            bottomCommonImageUrl: null,
            bottomCommonImageEnabled: false,
          },
          productImageUrls,
          sizeChartImageUrls,
          brandIntro,
        })
      : listing.description;

  return {
    originProduct: {
      statusType: "SALE",
      saleType: "NEW",
      leafCategoryId,
      name: listing.title,
      images: {
        representativeImage: representativeUrl ? toImageRef(representativeUrl) : { url: "" },
        optionalImages: optionalUrls.length > 0 ? optionalUrls.map(toImageRef) : undefined,
      },
      detailContent,
      salePrice: listing.priceKrw,
      stockQuantity: product.stockQuantity.value || 1,
      deliveryInfo: {
        // N-3.49(2026-08-17, 실제 등록 3차 시도로 발견) — deliveryType/
        // deliveryAttributeType이 NotValidEnum으로 거부됐다(둘 다 한 번도
        // payload에 채워진 적이 없었음). CartPilot은 해외구매대행 상품을
        // 전부 국내 택배(EPOST 등)로 재배송하므로 DELIVERY(직접배송/화물이
        // 아님) + NORMAL(오늘출발/새벽배송 등 특수 옵션 없음) 고정값이다 —
        // 상품마다 달라질 여지가 없어 입력 필드로 만들지 않는다.
        deliveryType: "DELIVERY",
        deliveryAttributeType: "NORMAL",
        // N-3.6(개정 Part A) — 조회 API는 없지만(확인 유지) 판매자가 Settings에서
        // 직접 입력한 값이 있으면 채운다(Coupang과 같은 수동 입력 패턴).
        deliveryCompany: deliveryCompany ?? undefined,
        deliveryFee: {
          deliveryFeeType: "FREE",
          baseFee: 0,
        },
        claimDeliveryInfo: {
          // N-3.3 — 출고지는 이 필드 하나다(deliveryInfo.outboundLocationId는
          // 존재하지 않는 필드였음이 확인되어 제거됨).
          shippingAddressId: releaseAddressBookNo ?? undefined,
          returnAddressId: refundAddressBookNo ?? undefined,
          returnDeliveryCompanyPriorityType:
            (primaryReturnDeliveryCompanyPriorityType as NaverClaimDeliveryInfo["returnDeliveryCompanyPriorityType"]) ??
            undefined,
          returnDeliveryFee: returnDeliveryFee ?? undefined,
          exchangeDeliveryFee: exchangeDeliveryFee ?? undefined,
        },
      },
      detailAttribute: {
        // 고시 의무는 인증서 보유 여부와 무관하게 항상 존재한다 — 카테고리가
        // CHILD_CERTIFICATION 대상이면 KIDS, 아니면 일반 의류(WEAR) 타입을 쓴다.
        // N-3.13 Part E-12 — 공식 OpenAPI 스펙(ExternalApiWearInfoProvidedNoticeVo/
        // ExternalApiKidsInfoProvidedNoticeVo.product)의 required 배열을 직접
        // 확인했다. warrantyPolicy/afterServiceDirector도 두 타입 모두 필수라
        // SellerProfile 재사용 값을 채운다(추측 아님 — 스펙 원문 확인, 아래
        // validate-payload.ts에 근거 주석).
        // N-3.45(CPO 지시: "상품정보제공고시 공통 관리") — material/color/
        // manufacturer/caution(careInstructions)/recommendedAge/itemName/
        // modelName/weight는 이제 실제 값이 없어도 사용자가 "상세페이지 참조"를
        // 선택했으면(product.X.source === DETAIL_PAGE_REFERENCE) 참조 문구로
        // 채운다 — resolveNoticeFieldValue가 화이트리스트(reference-eligibility.ts)
        // 기준으로 판단한다. certificationType은 이 화이트리스트에 없어(KC 관련,
        // STEP10 영구 제외) 여기서는 여전히 실제 값만 채운다.
        productInfoProvidedNotice: categoryRequiresChildCertification
          ? {
              productInfoProvidedNoticeType: "KIDS",
              material: resolveNoticeFieldValue("material", product.material),
              color: resolveNoticeFieldValue("color", product.color),
              size: resolveSizeFromOptions(product),
              manufacturer: resolveNoticeFieldValue("manufacturer", product.manufacturer),
              caution: resolveNoticeFieldValue("careInstructions", product.careInstructions),
              recommendedAge: resolveNoticeFieldValue("recommendedAge", product.recommendedAge),
              warrantyPolicy: warrantyPolicy || undefined,
              afterServiceDirector: afterServiceDirector || undefined,
              itemName: resolveNoticeFieldValue("itemName", product.itemName),
              modelName: resolveNoticeFieldValue("modelName", product.modelName),
              weight: resolveNoticeFieldValue("weight", product.weight),
              // KC 인증정보 설명 텍스트 — N-3.45 STEP10(CPO 지시)에 따라 절대
              // "상세페이지 참조"로 대체하지 않는다. 실제 값만 채운다.
              certificationType: product.certificationType?.value || undefined,
            }
          : {
              productInfoProvidedNoticeType: "WEAR",
              material: resolveNoticeFieldValue("material", product.material),
              color: resolveNoticeFieldValue("color", product.color),
              size: resolveSizeFromOptions(product),
              manufacturer: resolveNoticeFieldValue("manufacturer", product.manufacturer),
              caution: resolveNoticeFieldValue("careInstructions", product.careInstructions),
              warrantyPolicy: warrantyPolicy || undefined,
              afterServiceDirector: afterServiceDirector || undefined,
            },
        // N-3.4 — originAreaCode는 GET /v1/product-origin-areas로 실측 확인한
        // 535개 코드 중 resolveNaverOriginArea가 매칭한 값을 그대로 쓴다(이
        // 함수는 매칭을 다시 하지 않는다 — Resolver → Payload 단방향 원칙).
        // content는 04(직접입력)로 폴백된 경우에만 스펙상 필수라 그때만 채운다.
        // N-3.29(CPO 지시) — importer(수입사명)는 CartPilot.product.importer에
        // 사용자가 직접 입력한 값이 있으면 그대로 채운다(다른 필드에서 추론하지
        // 않는다). 값이 없으면 여전히 undefined — validate-payload.ts가 수입산
        // (02) 코드일 때만 MISSING으로 표시한다.
        // N-3.45 STEP8(CPO 지시) — "구매대행이라고 해서 판매자가 법적으로
        // 수입자인 것은 아니다"(CPO가 내 이전 오판을 직접 정정). 판매자의
        // 수입자 지위가 실제로 확인되지 않았으면 자동 추정하지 않고, 사용자가
        // "상세페이지 참조"를 선택했을 때만 참조 문구로 채운다(resolveNoticeFieldValue).
        originAreaInfo: originAreaCode
          ? {
              originAreaCode,
              content: originAreaRequiresContent ? product.countryOfOrigin.value || undefined : undefined,
              importer: resolveNoticeFieldValue("importer", product.importer),
            }
          : undefined,
        optionInfo:
          hasRealProductOptions(product)
            ? {
                useStockManagement: true,
                // N-3.49(실측 확인) — optionGroupName1..4 필드를 가진 객체다,
                // 배열이 아니다(types.ts의 NaverOptionCombinationGroupNames 주석
                // 참고 — 실제 등록 시도에서 HTTP 400으로 확인된 버그).
                optionCombinationGroupNames: buildOptionCombinationGroupNames(product.optionGroups),
                optionCombinations: buildOptionCombinations(product, listing.priceKrw),
              }
            : undefined,
        // N-3.49(2026-08-17, 실제 등록 3차 시도로 발견) — minorPurchasable이
        // NotNull로 거부됐다. CartPilot은 성인전용(주류/담배/유해물건 등)
        // 카테고리를 취급하지 않으므로 항상 true(미성년자 구매 가능) —
        // 카테고리별로 달라질 여지가 생기면 그때 입력값으로 분리한다.
        minorPurchasable: true,
        // N-3.49(2026-08-17, 실제 등록 3차 시도로 발견) — afterServiceInfo가
        // NotNull로 거부됐다. productInfoProvidedNotice.afterServiceDirector와
        // 같은 SellerProfile.asContactNumber 값을 재사용한다(이 판매자가 실제로
        // 입력해둔 값이 "해외 구매대행으로 A/S 불가"라는 문구이고, 이미 Coupang
        // 실등록에서 "소비자상담 관련 전화번호" 자리에 동일하게 쓰여 왔다 — 새로
        // 지어내는 값이 아니다).
        afterServiceInfo: afterServiceDirector
          ? {
              afterServiceTelephoneNumber: afterServiceDirector,
              afterServiceGuideContent: afterServiceDirector,
            }
          : undefined,
      },
      // N-3.29(CPO 지시) — 판매자가 실제로 취득한 인증정보를 product.childCertification에
      // 직접 입력했으면(Editor) 그 값을 그대로 채운다. 값이 없으면(대부분의 경우)
      // 지금까지처럼 certificationInfoId만 있는 자리표시자를 만든다 —
      // validate-payload.ts가 certificationNumber/companyName/certificationDate가
      // 전부 채워졌을 때만 READY로 판정한다(임의 값 생성 없음, CPO 지시).
      productCertificationInfos:
        childCertificationInfoId !== null
          ? [
              {
                certificationInfoId: childCertificationInfoId,
                ...(product.childCertification?.value
                  ? {
                      certificationNumber: product.childCertification.value.certificationNumber || undefined,
                      companyName: product.childCertification.value.companyName || undefined,
                      certificationDate: product.childCertification.value.certificationDate || undefined,
                    }
                  : {}),
              },
            ]
          : undefined,
    },
    smartstoreChannelProduct: {
      channelProductName: listing.title,
      // N-3.5 — 공식 OpenAPI 스펙 재검증 중 발견: "ON, SUSPENSION만 입력
      // 가능합니다"라고 명시돼 있어 WAIT는 실제로 입력 불가능한 값이었다
      // (지금까지 여기 있던 버그 — DRY_RUN이라 실제 POST로 드러난 적은
      // 없음). 새 상품을 등록 즉시 노출시키지 않는 게 안전하므로 유효한
      // 값 중 SUSPENSION(전시 중지)을 기본값으로 쓴다.
      channelProductDisplayStatusType: "SUSPENSION",
      // N-3.25(STEP 2) — 스펙 재확인 결과: "네이버쇼핑 광고주가 아니면 무엇을
      // 보내든 서버가 강제로 false로 저장한다"고 명시되어 있어, false를 명시
      // 전송하는 것이 광고주가 아닌 절대다수 계정의 실제 결과와 정확히 같고
      // (판단 불필요), 광고주인 계정에도 자동 등록 흐름에서는 "미연동"이 더
      // 안전한 기본값이다(연동은 등록 후 Wing에서 판매자가 직접 선택 가능).
      // required 필드를 비워 보내는 것보다(스키마 필수값 누락으로 거부될 위험)
      // 명시적으로 안전한 값을 채우는 쪽을 택한다.
      naverShoppingRegistration: false,
    },
  };
}
