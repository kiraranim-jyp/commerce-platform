import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import { computeVariantFinalPriceKrw } from "@commerce/pricing";
import { resolveProductSignals } from "@commerce/category";
import { assembleContentsFromBlocks, BLANK_COUPANG_SELLER_CONFIG } from "../coupang/build-payload";
import type { CoupangDescriptionTemplate, CoupangSellerConfig, DetailPageBlock } from "../coupang/build-payload";
import type {
  NaverClaimDeliveryInfo,
  NaverImageRef,
  NaverOptionCombination,
  NaverOptionCombinationGroupNames,
  NaverProductRegistrationPayload,
} from "./types";
import { resolveNoticeFieldValue, DETAIL_PAGE_REFERENCE_TEXT } from "../notice/reference-eligibility";

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
  /** N-3.69(CPO 지시, "Seller 공통 설정 통합" STEP1) — 지금까지 이 payload는
   * product.shippingFee/SellerProfile.deliveryCharge를 전혀 읽지 않고
   * deliveryFee를 항상 FREE/0으로 고정했다(Coupang은 이미
   * sellerConfig.deliveryCharge를 올바르게 읽고 있었음 — 실제 발견된
   * "DB에는 있지만 SmartStore가 안 읽는" 갭). product.shippingFee가 사용자가
   * 실제로 편집한 값(DEFAULT가 아님)이면 그 값을 쓰고, 아직 기본값(DEFAULT)일
   * 때만 SellerProfile.deliveryCharge를 쓴다(Coupang build-payload.ts의
   * deliveryCharge 계산과 동일한 우선순위). null이면(SellerProfile 미설정)
   * 기존처럼 FREE로 남는다 — 임의 배송비를 지어내지 않는다. */
  sellerDeliveryFee: number | null;
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
  /** N-3.51 STEP2(CPO 지시, 실제 등록 실패 원인 조사) — detailAttribute.
   * afterServiceInfo.afterServiceTelephoneNumber는 afterServiceDirector와
   * 다른 필드다: 후자는 자유 텍스트를 허용하는 고시용 항목("해외 구매대행으로
   * A/S 불가" 같은 문구가 실제로 통과)이지만, 전자는 네이버가 실제로 숫자/-/+
   * 만 허용하는 엄격한 전화번호 포맷(N-3.49 5차 실등록 시도에서 실측 확인)이라
   * 같은 소스를 재사용할 수 없다. SellerProfile.companyContactNumber(Coupang
   * 쪽에서 이미 실제 전화번호로 채워져 있던 필드, 예: "+821046458306")를
   * 재사용한다 — 임의 전화번호를 지어내지 않는다(CPO 지시). 값이 없으면
   * undefined로 두고 validate-payload.ts가 MISSING으로 표시한다. */
  afterServiceTelephoneNumber?: string | null;
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
  /** N-3.83(CPO 지시, "SmartStore 기본정보 완성" 감사에서 발견한 실제 갭) —
   * Coupang은 이미 build-payload.ts:1102에서 `product.manufacturer.value ||
   * brandProfile?.manufacturer || sellerConfig.manufacturer`(상품추출>브랜드
   * 기본값>Seller기본값, Sprint A-12 작업4) 3단계 폴백을 쓰고 있었는데, Naver
   * 쪽은 이 파일이 BrandProfile/SellerProfile을 전혀 몰라 product.manufacturer만
   * 봤다 — 크롤러가 제조사를 못 찾으면(흔한 경우) 무조건 빈칸이었다. 이 필드는
   * 호출부(resolve-context.ts)가 이미 계산해 둔 브랜드/Seller 기본값 폴백
   * 결과를 그대로 받는다(이 함수는 DB를 조회하지 않는다는 기존 원칙 유지 —
   * originAreaCode/deliveryCompany와 같은 패턴). product.manufacturer.value가
   * 있으면(실제 원문 추출값) 그게 항상 우선이고, 없을 때만 이 값으로 보충한다. */
  resolvedManufacturer?: string | null;
  /** N-4.00 A-2(대표님 지시, N-3.87 설계 확정 후 구현) — resolveNaverProductAttributes()
   * 가 이미 계산해 둔 결과(attributeSeq/attributeValueSeq 쌍)를 그대로 받는다
   * (이 함수는 카테고리 속성 메타데이터를 조회하거나 매칭 로직을 다시 하지
   * 않는다 — Resolver → Payload 단방향 원칙, originAreaCode와 동일 패턴). 값이
   * 없으면(빈 배열/undefined) N-3.85에서 공식 스펙으로 확인된 필드 경로이지만
   * detailAttribute.productAttributes 자체를 생략한다(임의로 빈 배열을 보내지
   * 않는다 — Naver가 빈 배열과 필드 누락을 다르게 처리할 수 있어 안전하게
   * 아예 생략). */
  resolvedAttributes?: { attributeSeq: number; attributeValueSeq: number }[];
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
    // Sprint A-4(CPO 지시 — 발견된 버그 수정) — 여기 있던 이전 계산
    // (`convertToKrw(variant.price) - salePrice`)은 마진/수수료가 이미 적용된
    // salePrice에서 마진 없는 원본 환산값을 빼는 것이라, 마진이 0이 아닌 한
    // (기본값 20%+수수료 10%) 실제와 다른(대개 부호가 뒤집힌) 델타가 나왔다
    // — 기본 $77(최종 ₩165,640)에 옵션 Red $82(기본보다 비쌈)를 넣으면
    // convertToKrw(82)-165,640 ≈ -55,000으로 "더 싸다"는 반대 결과가 나왔다.
    // computeVariantFinalPriceKrw는 원본 통화 단계에서 먼저 차액을 구하고
    // 그 차액만 환산해서(마진 재적용 없음) 기본 최종가에 더한다 — Naver
    // optionCombinations.price 필드 자체가 "기본 salePrice 대비 차액"이라는
    // 사실(N-3.47에서 공식 확인)은 그대로 유지하면서 계산만 바로잡는다.
    const variantResult = variant.price
      ? computeVariantFinalPriceKrw(
          { amount: product.price.value.amount, currency: product.price.value.currency, finalKrw: salePrice },
          { amount: variant.price.amount, currency: variant.price.currency, mode: variant.priceMode },
        )
      : { finalKrw: salePrice, applied: false };
    const priceDelta = variantResult.finalKrw - salePrice;
    const combo: NaverOptionCombination = {
      stockQuantity: variant.stockQuantity ?? product.stockQuantity.value ?? 0,
      price: priceDelta,
      usable: true,
    };
    if (variant.sku) combo.sellerManagerCode = variant.sku;
    // N-3.50(STEP1/2 재검토) — optionGroupName은 최대 3개까지만 채워지는데
    // (buildOptionCombinationGroupNames), 여기는 4번째까지(optionName4) 채우고
    // 있었다 — 짝이 없는 optionName4가 생기는 불일치였다. 두 함수가 항상 같은
    // 상한(3)을 쓰도록 맞춘다(4번째 옵션 그룹은 애초에 Naver가 지원하지 않음).
    if (values[0]) combo.optionName1 = values[0];
    if (values[1]) combo.optionName2 = values[1];
    if (values[2]) combo.optionName3 = values[2];
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
  // N-3.82(CPO 지시, N-3.78 STEP2에서 발견한 Case E 처리 방침 확정) —
  // optionGroups만 보고 "실제 옵션 있음"으로 판단하면, variants가 비어 있을
  // 때(예: 원본 파싱이 절반만 성공해 실제 SKU 조합을 못 만든 경우) "옵션
  // 그룹 이름은 선언했는데 조합은 0개"인 깨진 payload가 그대로 나간다
  // (buildOptionCombinations는 product.variants를 순회해서 조합을 만들기
  // 때문에 그룹만 있고 variants가 없으면 결과가 항상 빈 배열이다). variants가
  // 하나도 없으면 optionGroups 내용과 무관하게 "옵션 없음"으로 판정해
  // optionInfo 블록 자체를 생략한다 — 빈 조합을 가진 채 보내느니 옵션
  // 섹션을 아예 안 보내는 게 안전하다는 CPO 지시.
  if (product.variants.length === 0) return false;
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
 * N-3.65(2026-08-20, 실제 등록으로 발견) — 어린이인증 대상 카테고리는
 * naverShoppingSearchInfo.modelName이 NotEmpty로 요구된다. 이 값을 CartPilot이
 * 지어내지 않고, 상품 원문 설명에 실제로 적힌 "Product code XXXX" 같은 문구가
 * 있을 때만 그 실제 코드를 그대로 추출한다(편집샵 상세설명에 흔한 관용구 —
 * 예: "Product code B126AC050 SS26 Made in Spain."). 패턴이 없으면 undefined를
 * 돌려주고 build-payload.ts는 그 필드를 아예 채우지 않는다(임의 값 금지).
 */
export function resolveModelNameFromDescription(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const match = description.match(/product code:?\s+([A-Za-z0-9][A-Za-z0-9-]*(?:\s+[A-Za-z0-9-]+){0,2}?)(?=\s+made in\b|[.,]|$)/i);
  const code = match?.[1]?.trim();
  return code ? code : undefined;
}

/** N-3.77 STEP1(CPO 지시: "원문에 없는 정보는 만들지 않는다") — "시즌"은
 * CanonicalProduct에 별도 필드가 없다. 편집샵 상세설명의 "Product code B126AC050
 * SS26" 같은 관용구에 시즌+연도 코드가 실제로 적혀 있을 때만(resolveModelNameFromDescription과
 * 같은 원문 소스) 뽑아낸다 — 없으면 undefined(추정 금지). "SS26"/"26SS"/"FW26"/
 * "26FW"/"AW26" 등 순서와 상관없이 매칭하고, 출력은 "연도+계절"(예: "26FW")
 * 순서로 통일한다. */
export function resolveSeasonFromText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const seasonCodes = "SS|FW|AW|SU|WI";
  const yearFirst = new RegExp(`\\b(\\d{2})[\\s-]?(${seasonCodes})\\b`, "i");
  const codeFirst = new RegExp(`\\b(${seasonCodes})[\\s-]?(\\d{2})\\b`, "i");
  const m1 = text.match(yearFirst);
  if (m1) return `${m1[1]}${m1[2].toUpperCase()}`;
  const m2 = text.match(codeFirst);
  if (m2) return `${m2[2]}${m2[1].toUpperCase()}`;
  return undefined;
}

/** N-3.77 STEP1(CPO 지시) — ageGroup/gender를 "키즈"/"베이비"/"여성"/"남성" 같은
 * 상품명용 타겟 단어로 바꾼다. resolveProductSignals()가 이미 원문(breadcrumb/
 * URL/JSON-LD/키워드/recommendedAge)에서 근거를 갖고 판정한 값만 쓴다 — 여기서
 * 새로 추측하지 않는다. unisex/unknown은 상품명에 굳이 넣지 않는다(불확실한
 * 값을 단정적으로 표시하지 않기 위함). girl/boy는 이미 ageGroup이 kids/baby일
 * 때가 대부분이라 성별 단어를 또 붙이면 "키즈 여아"처럼 중복돼 보여서, 상품명
 * 목적으로는 age 우선(더 넓고 확실한 신호)만 쓴다. */
function targetLabelFromSignals(ageGroup: string, gender: string): string {
  if (ageGroup === "baby") return "베이비";
  if (ageGroup === "kids") return "키즈";
  if (ageGroup === "teen") return "틴즈";
  if (ageGroup === "adult") {
    if (gender === "women") return "여성";
    if (gender === "men") return "남성";
  }
  return "";
}

/** N-3.77 STEP2(CPO 작업지시서 N-3.77) — SmartStore SEO 상품명 생성기.
 *
 * 구성: 브랜드 → 시즌(원문에 있을 때만) → 타겟(연령/성별 Resolver가 확신할
 * 때만) → 핵심 상품명(원문 title에서 브랜드 중복만 제거, 번역하지 않음).
 * 브랜드 한글 표기(예: "보보쇼즈")는 시스템 어디에도 매핑 데이터가 없어서
 * (BrandProfile에도 없고 실제 AI 번역 Provider도 연결 안 돼 있음) 임의로
 * 음차 변환하지 않는다 — 대표님 확인(2026-08-22): 원문 브랜드명(예: "Bobo
 * Choses")을 그대로 쓰기로 결정. 카탈로그명/모델코드는 상품명에 강제로
 * 넣지 않는다(CPO 지시). 중복 단어 제거 + 공백 정리 + 네이버 상품명 길이
 * 제한(100자, 공식 문서 기준)을 넘으면 단어 단위로 뒤에서부터 잘라낸다(글자
 * 중간에서 끊지 않는다). */
const NAVER_PRODUCT_NAME_MAX_LENGTH = 100;

export function generateSmartStoreProductName(product: CanonicalProduct): string {
  const brand = product.brand.value.trim();
  const season = resolveSeasonFromText(`${product.title.value} ${product.description.value}`);
  const signals = resolveProductSignals(product);
  const target = targetLabelFromSignals(signals.ageGroup, signals.gender);

  let coreName = product.title.value.trim();
  // "by <Brand>"가 제목 끝에 중복돼 붙는 편집샵 관용구(예: "... by Bobo Choses")
  // — 브랜드가 접두부에 이미 들어가므로 뒤쪽 중복만 먼저 제거한다.
  if (brand) {
    const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const byBrandSuffix = new RegExp(`\\s*[-–—]?\\s*by\\s+${escapedBrand}\\s*$`, "i");
    coreName = coreName.replace(byBrandSuffix, "").trim();
    // 브랜드 전체 구문(여러 단어)이 핵심명 어디에 있든(맨 앞이든 "[TEST]" 같은
    // 태그 뒤든) 그 통구문만 제거한다 — "Cap ... Baseball Cap"처럼 단어
    //하나(예: "Cap")만 우연히 겹치는 자연스러운 반복은 여기서 안 건드린다.
    // brand가 여러 단어(예: "Bobo Choses")일 때만 유의미하게 동작하도록
    // 단어 경계(\b)로 정확히 매칭한다.
    const brandPhrase = new RegExp(`\\b${escapedBrand}\\b`, "gi");
    coreName = coreName.replace(brandPhrase, " ").replace(/\s{2,}/g, " ").trim();
  }
  coreName = coreName.replace(/^[-–—:,\s]+|[-–—:,\s]+$/g, "");

  const prefixParts = [brand, season, target].filter((p): p is string => Boolean(p && p.trim()));
  const coreWords = coreName.split(/\s+/).filter(Boolean);
  const words = [...prefixParts.flatMap((p) => p.split(/\s+/)), ...coreWords].filter(Boolean);

  let name = words.join(" ").replace(/\s{2,}/g, " ").trim();
  if (name.length > NAVER_PRODUCT_NAME_MAX_LENGTH) {
    const kept: string[] = [];
    let length = 0;
    for (const word of words) {
      const nextLength = length + (kept.length > 0 ? 1 : 0) + word.length;
      if (nextLength > NAVER_PRODUCT_NAME_MAX_LENGTH) break;
      kept.push(word);
      length = nextLength;
    }
    name = kept.join(" ");
  }
  return name;
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
    sellerDeliveryFee,
    returnDeliveryFee,
    exchangeDeliveryFee,
    childCertificationInfoId,
    categoryRequiresChildCertification,
    originAreaCode,
    originAreaRequiresContent,
    deliveryCompany,
    warrantyPolicy,
    afterServiceDirector,
    afterServiceTelephoneNumber,
    detailBlocks,
    descriptionTemplate,
    commonImages,
    brandIntro,
    resolvedManufacturer,
    resolvedAttributes,
  } = input;

  // N-3.83 — product.manufacturer.value(실제 원문 추출값)가 항상 우선이고,
  // 없을 때만 호출부가 이미 계산해 둔 브랜드/Seller 기본값 폴백으로 보충한다.
  const manufacturerValue = product.manufacturer.value.trim() || resolvedManufacturer?.trim() || "";

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

  // N-3.69 — Coupang build-payload.ts의 deliveryCharge 계산과 동일한 우선순위:
  // 사용자가 실제로 편집한 배송비(DEFAULT가 아님)가 있으면 그 값, 아직
  // 기본값이면 SellerProfile.deliveryCharge, 둘 다 없으면 undefined(기존
  // FREE/0 동작 유지 — 임의 배송비를 지어내지 않는다).
  const resolvedDeliveryFee =
    product.shippingFee.source !== "DEFAULT"
      ? product.shippingFee.value
      : (sellerDeliveryFee ?? product.shippingFee.value);

  // N-3.77 STEP2 — SEO 상품명 생성이 실패하거나 빈 문자열을 돌려주는 예외적인
  // 경우(원문 title 자체가 비어있는 등)에는 지금까지처럼 listing.title로
  // 폴백한다(회귀 방지).
  const smartStoreProductName = generateSmartStoreProductName(product) || listing.title;

  return {
    originProduct: {
      statusType: "SALE",
      saleType: "NEW",
      leafCategoryId,
      name: smartStoreProductName,
      images: {
        representativeImage: representativeUrl ? toImageRef(representativeUrl) : { url: "" },
        optionalImages: optionalUrls.length > 0 ? optionalUrls.map(toImageRef) : undefined,
      },
      detailContent,
      salePrice: listing.priceKrw,
      stockQuantity: product.stockQuantity.value || 1,
      // 대표님 지시(N-3.84, 실등록 화면 대조로 발견) — "판매자상품코드"가
      // 지금까지 아예 채워지지 않았다. 임의 코드를 만들지 않고, 원본 페이지에서
      // 실제 추출된 product.sku가 있을 때만 채운다(없으면 생략 — 다른 모든
      // 필드와 동일한 "값 지어내기 금지" 원칙).
      sellerManagementCode: product.sku.value || undefined,
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
        // 대표님 지시(N-3.85 STEP5: "묶음배송 = 항상 사용", 공식 OpenAPI 스펙으로
        // 확인됨) — 그룹 코드를 null로 두면 Naver 기본 묶음배송 그룹으로
        // 저장된다("묶음배송 가능이 true이고 그룹 코드가 null이면 기본 그룹으로
        // 저장됩니다" — 스펙 원문). 판매자가 Wing에서 커스텀 그룹을 만들지
        // 않는 이상 CartPilot이 그룹 ID를 추측해서 넣지 않는다.
        deliveryBundleGroupUsable: true,
        deliveryBundleGroupId: null,
        deliveryFee: {
          deliveryFeeType: resolvedDeliveryFee > 0 ? "PAID" : "FREE",
          baseFee: resolvedDeliveryFee > 0 ? resolvedDeliveryFee : 0,
          // N-3.71 STEP8(실제 프로덕션 등록 시도로 발견) — deliveryFeeType이
          // PAID일 때 Naver가 "originProduct.deliveryInfo.deliveryFee.
          // deliveryFeePayType: 결제방식 항목을 입력해 주세요"로 거부했다 —
          // 이 필드는 types.ts에 이미 정의돼 있었지만 한 번도 채운 적이
          // 없었다. CartPilot은 항상 마켓플레이스 체결 시점에 배송비를 함께
          // 선결제 받는 모델이라(착불/화물 배송 없음) PAID일 때 항상
          // "PREPAID"로 고정한다 — FREE일 때는 Naver가 이 필드를 요구하지
          // 않아 생략한다(임의 값 추가 금지).
          deliveryFeePayType: resolvedDeliveryFee > 0 ? "PREPAID" : undefined,
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
        // N-3.51 STEP1 — material/color/size 등은 productInfoProvidedNoticeType과
        // 나란히(flat) 놓이지 않는다. wear/kids 하위 객체로 한 번 더 감싸야
        // 한다(types.ts의 NaverProductInfoProvidedNoticeWear/Kids 주석 참고 —
        // 5차 실등록 시도의 실제 NotEmpty 거부 + 공식 GitHub Discussion
        // #241/#516 2개 독립 출처로 확인).
        productInfoProvidedNotice: categoryRequiresChildCertification
          ? {
              productInfoProvidedNoticeType: "KIDS",
              kids: {
                material: resolveNoticeFieldValue("material", product.material),
                color: resolveNoticeFieldValue("color", product.color),
                // N-3.71 — size는 reference-eligibility.ts 화이트리스트에 없어
                // (사용자가 선택할 소스 토글 자체가 없다) resolveSizeFromOptions가
                // undefined면 이전까지 필드 자체가 비어 payload에서 통째로
                // 빠졌다 — 이게 실제 등록에서 Naver가 거부한 9개 필드 중
                // 하나였다. size는 같은 productInfoProvidedNotice 안의 다른
                // 자유텍스트 필드(material/color 등)와 완전히 동일한 스펙
                // 타입이라 "상세페이지 참조" 대체가 동일하게 허용된다(9개
                // 필드가 전부 같은 방식으로 거부됐다는 사실 자체가 근거) —
                // releaseDateText/packDateText와 같은 이유로 실제 SIZE 옵션이
                // 없을 때는 무조건 참조 문구로 채운다(임의 사이즈 값을
                // 지어내는 게 아니라 "상세페이지를 보라"는 안전한 대체).
                size: resolveSizeFromOptions(product) ?? DETAIL_PAGE_REFERENCE_TEXT,
                manufacturer: resolveNoticeFieldValue(
                  "manufacturer",
                  manufacturerValue ? { ...product.manufacturer, value: manufacturerValue } : product.manufacturer,
                ),
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
                // N-3.51 STEP1(6차 실등록 시도로 발견) — releaseDate(YearMonth,
                // 구조화된 출시연월)는 CartPilot이 알 방법이 없다(크롤러가
                // 추출하지 않음, 임의 날짜를 지어내지 않는다는 원칙 유지).
                // 공식 스펙에 releaseDateText("동일 모델 출시연월 직접 입력",
                // fieldType String)가 releaseDate의 자유 텍스트 대체 필드로
                // 존재해, material/color처럼 상세페이지 참조 관용구를 쓴다.
                releaseDateText: DETAIL_PAGE_REFERENCE_TEXT,
              },
            }
          : {
              productInfoProvidedNoticeType: "WEAR",
              wear: {
                material: resolveNoticeFieldValue("material", product.material),
                color: resolveNoticeFieldValue("color", product.color),
                // N-3.71 — size는 reference-eligibility.ts 화이트리스트에 없어
                // (사용자가 선택할 소스 토글 자체가 없다) resolveSizeFromOptions가
                // undefined면 이전까지 필드 자체가 비어 payload에서 통째로
                // 빠졌다 — 이게 실제 등록에서 Naver가 거부한 9개 필드 중
                // 하나였다. size는 같은 productInfoProvidedNotice 안의 다른
                // 자유텍스트 필드(material/color 등)와 완전히 동일한 스펙
                // 타입이라 "상세페이지 참조" 대체가 동일하게 허용된다(9개
                // 필드가 전부 같은 방식으로 거부됐다는 사실 자체가 근거) —
                // releaseDateText/packDateText와 같은 이유로 실제 SIZE 옵션이
                // 없을 때는 무조건 참조 문구로 채운다(임의 사이즈 값을
                // 지어내는 게 아니라 "상세페이지를 보라"는 안전한 대체).
                size: resolveSizeFromOptions(product) ?? DETAIL_PAGE_REFERENCE_TEXT,
                manufacturer: resolveNoticeFieldValue(
                  "manufacturer",
                  manufacturerValue ? { ...product.manufacturer, value: manufacturerValue } : product.manufacturer,
                ),
                caution: resolveNoticeFieldValue("careInstructions", product.careInstructions),
                warrantyPolicy: warrantyPolicy || undefined,
                afterServiceDirector: afterServiceDirector || undefined,
                // N-3.51 STEP1(6차 실등록 시도의 실제 NotEmpty 거부로 발견) —
                // packDate(YearMonth, 구조화된 제조연월)는 CartPilot이 알 방법이
                // 없다(해외 구매대행 특성상 개별 상품의 제조연월을 크롤러가
                // 얻을 수 없고, 임의 날짜를 지어내지 않는다는 원칙 유지).
                // 공식 스펙에 packDateText("제조연월 직접 입력", fieldType
                // String)가 packDate의 자유 텍스트 대체 필드로 존재해,
                // material/color처럼 상세페이지 참조 관용구를 쓴다
                // (docs/naver-provided-notice-types-raw.json 실측 확인).
                packDateText: DETAIL_PAGE_REFERENCE_TEXT,
              },
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
        // N-3.51 STEP6(7차 실등록 시도로 발견) — 출고지가 해외 주소인 경우
        // NotNull("customsTaxType.required.overseas"). CartPilot은 항상
        // 해외구매대행이라 출고지가 항상 해외 주소다(deliveryType/
        // minorPurchasable과 같은 사업모델 전체 고정값). "INCLUDED"(관부가세
        // 포함) 근거는 types.ts의 NaverDetailAttribute.customsTaxType 주석
        // 참고 — CartPilot 판매가가 이미 원가+마진+수수료를 반영한 단일
        // 최종가라 체크아웃에서 관부가세를 별도로 청구하지 않는 기존 가격
        // 구조와 일치시킨 값이다.
        customsTaxType: "INCLUDED",
        // N-3.51 STEP2(CPO 지시, 실제 등록 5차 시도 실패 원인 재조사) —
        // afterServiceTelephoneNumber는 afterServiceDirector(자유 텍스트,
        // "해외 구매대행으로 A/S 불가" 같은 문구도 통과하는 고시용 필드)를
        // 더 이상 재사용하지 않는다 — 실제 등록에서 "A/S전화번호는 숫자, -, +만
        // 입력 가능합니다"로 거부됐다(N-3.49 5차 시도 실측). 대신
        // SellerProfile.companyContactNumber(Coupang 쪽에서 이미 실제 전화번호
        // 형식으로 채워져 있는 필드, 예: "+821046458306")를 쓴다 — 임의
        // 전화번호를 만들지 않는다(CPO 지시). afterServiceGuideContent는
        // 안내문이라 자유 텍스트인 afterServiceDirector를 그대로 쓴다.
        afterServiceInfo: afterServiceTelephoneNumber
          ? {
              afterServiceTelephoneNumber,
              afterServiceGuideContent: afterServiceDirector || undefined,
            }
          : undefined,
        // N-3.65 — 실제 원문에 "Product code XXXX" 같은 문구가 있을 때만 채운다
        // (resolveModelNameFromDescription 참고, 임의 값 금지). modelId(네이버
        // 카탈로그 상품 ID)는 CartPilot이 알 수 없어 채우지 않는다.
        // N-3.76(2차, CPO 지시) — manufacturerName/brandName은 product.manufacturer/
        // product.brand가 이미 갖고 있는 값을 그대로 연결한 것뿐이다(새 Resolver
        // 아님, 임의 값 생성 아님) — 지금까지 이 객체에 modelName만 채우고 이
        // 두 필드는 아예 빠져 있었던 게 스마트스토어센터의 "제조사명/브랜드명 -"
        // 표시의 원인이었다. 셋 다 없으면(모델명도 못 찾고 브랜드/제조사도
        // 없으면) undefined로 필드 자체를 생략한다(기존 규칙 유지).
        naverShoppingSearchInfo: (() => {
          const modelName = resolveModelNameFromDescription(product.description.value);
          const manufacturerName = manufacturerValue || undefined;
          const brandName = product.brand.value.trim() || undefined;
          return modelName || manufacturerName || brandName
            ? { modelName, manufacturerName, brandName }
            : undefined;
        })(),
        // N-3.29(CPO 지시) — 판매자가 실제로 취득한 인증정보를 product.childCertification에
        // 직접 입력했으면(Editor) 그 값을 그대로 채운다. 값이 없으면(대부분의 경우)
        // 지금까지처럼 certificationInfoId만 있는 자리표시자를 만든다 —
        // validate-payload.ts가 certificationNumber/companyName/certificationDate가
        // 전부 채워졌을 때만 READY로 판정한다(임의 값 생성 없음, CPO 지시).
        //
        // N-3.66(CEO 승인 2026-08-20) — 실측/공식 문서로 확인한 사실: (1) Naver는
        // 어린이제품(CHILD_CERTIFICATION) 카테고리에 구매대행 면제(kindType=OVERSEAS)를
        // 제공하지 않는다 — 우리가 캐시해둔 실제 카테고리 인증 카탈로그에서
        // 어린이제품 인증 3종(id 1040/1041/1042)의 kindTypes는 전부
        // ["ETC","CHILD_CERTIFICATION","KC_CERTIFICATION"]뿐, OVERSEAS는 생활용품/
        // 전기용품류에만 있다(구조적 확인, 추측 아님). (2) 공식 GitHub Discussion
        // #704 예시로 productCertificationInfos에 certificationKindType이 항상
        // 필요함을 확인했다 — 실제 인증정보(childCertification)가 있으면 그
        // 인증 카탈로그 자체가 대표하는 종류인 CHILD_CERTIFICATION을 선택한다
        // (id=1042가 실제로 대표하는 kindTypes 중 하나 — 지어낸 값이 아니다).
        //
        // N-3.67(2026-08-20, 5연속 동일 거부 후 정적 스키마 재추적 — 진짜 원인) —
        // 공식 OpenAPI의 ExternalApiBaseProductDetailAttributeVo.product 스키마를
        // 직접 열어서 확인한 결과 productCertificationInfos는 detailAttribute의
        // 자식 필드다(NaverOriginProduct의 형제 필드가 아니다). 지금까지 5차
        // 실측 전부 이 필드를 originProduct 최상위에 넣고 있었다 — Naver가
        // detailAttribute 안쪽을 봤을 때 이 필드가 항상 "존재하지 않는" 상태였고,
        // 그래서 id/kindType/데이터를 5번 다르게 바꿔도 정확히 같은
        // "Empty...kindType" 오류가 반복됐다(값 문제가 아니라 위치 문제였다).
        // 실패 응답의 invalidInputs[0].name이 매번
        // "originProduct.detailAttribute.productCertificationInfos"였는데, 이
        // 경로를 문자 그대로 신뢰하지 않은 게 반복 실패의 진짜 원인이었다.
        // 공식 OpenAPI의 ExternalApiProductCertificationInfoVo.product는
        // required:[certificationInfoId, certificationNumber, name]이고, 이 중
        // `name`("인증 기관명" — 인증서 발급 기관명, companyName"인증 상호명"과는
        // 다른 필드)의 비필수 예외는 공급자적합성 유형(id=1042)에만 적용된다 —
        // 위치 수정과 별개로 이 필드도 함께 채운다.
        productCertificationInfos:
          childCertificationInfoId !== null && product.childCertification?.value
            ? [
                {
                  certificationInfoId: childCertificationInfoId,
                  certificationKindType: "CHILD_CERTIFICATION" as const,
                  name: product.childCertification.value.name || undefined,
                  certificationNumber: product.childCertification.value.certificationNumber || undefined,
                  companyName: product.childCertification.value.companyName || undefined,
                  certificationDate: product.childCertification.value.certificationDate || undefined,
                },
              ]
            : undefined,
        productAttributes: resolvedAttributes && resolvedAttributes.length > 0 ? resolvedAttributes : undefined,
      },
    },
    smartstoreChannelProduct: {
      channelProductName: smartStoreProductName,
      // N-3.5 — 공식 OpenAPI 스펙 재검증 중 발견: "ON, SUSPENSION만 입력
      // 가능합니다"라고 명시돼 있어 WAIT는 실제로 입력 불가능한 값이었다
      // (지금까지 여기 있던 버그 — DRY_RUN이라 실제 POST로 드러난 적은
      // 없음). 새 상품을 등록 즉시 노출시키지 않는 게 안전하므로 유효한
      // 값 중 SUSPENSION(전시 중지)을 기본값으로 쓴다.
      channelProductDisplayStatusType: "SUSPENSION",
      // N-3.25(STEP 2)에서는 false를 기본값으로 택했지만, 대표님 지시(N-3.84,
      // 실등록 화면 대조로 발견 — "네이버쇼핑 등록(N) -> Y 필요")로 true로
      // 뒤집는다. 스펙상 "네이버쇼핑 광고주가 아니면 무엇을 보내든 서버가
      // 강제로 false로 저장한다"는 동작은 그대로이므로 true를 보내도 광고주가
      // 아닌 계정은 결과가 달라지지 않고, 광고주인 계정만 실제로 켜진다 —
      // true 전송 자체에는 리스크가 없다(서버가 최종 결정권을 가진다).
      naverShoppingRegistration: true,
    },
  };
}
