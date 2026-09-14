import type { CanonicalProduct } from "@commerce/shared";
import {
  assembleNaverDetailContent,
  resolveDetailBlocks,
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnSalePeriod,
  type LotteOnChannelConfig,
  type LotteOnPayloadInput,
} from "@commerce/listing";
import { getDefaultSellerProfile } from "../../coupang/_lib/seller-profile";
import { getDefaultDescriptionTemplate } from "../../coupang/_lib/description-template";
import { findBrandProfileByName } from "../../coupang/_lib/brand-profile";
import { fetchLotteOnIdentity } from "./identity";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 3 — Preview와 Register가 **같은 입력**을
 * 만들게 하는 단 하나의 지점.
 *
 * N-4.12 STEP1 결론을 그대로 따른다: "Preview=Validation=Register가 같은
 * build/validate를 쓰는지가 유일한 검증 기준". 두 라우트가 각자 채널 설정을
 * 조립하면 "미리보기는 통과했는데 등록은 실패"가 재발한다.
 *
 * 상세페이지는 **새 조립 경로를 만들지 않는다** — 쿠팡/스마트스토어가 이미
 * 공유하는 resolveDetailBlocks() + assembleNaverDetailContent()를 그대로 쓴다
 * (같은 판매자의 같은 배송/반품 안내를 채널마다 다시 입력하게 하지 않는다).
 */

/** 화면이 보내는 롯데ON 전용 입력. 이 값들은 상품 데이터에서 파생할 수 없다. */
export interface LotteOnChannelFormInput {
  standardCategoryNo?: string;
  displayCategoryNos?: string[];
  originCode?: string;
  taxTypeCode?: string;
  noticeItemCode?: string;
  noticeArticles?: { pdArtlCd: string; pdArtlCnts: string }[];
  safetyCertifications?: { sftyAthnTypCd: string; sftyAthnOrgnNm?: string; sftyAthnNo: string }[];
  importProxyCode?: string;
  brandNo?: string;
  outboundPlaceNo?: string;
  returnPlaceNo?: string;
  deliveryCostPolicyNo?: string;
  deliveryRegionGroupCode?: string;
  courierCode?: string;
  returnCourierCode?: string;
  shipBudgetDays?: number;
  weekdayCloseTime?: string;
  saturdayShippingAvailable?: boolean;
  saturdayCloseTime?: string;
  externalProductNo?: string;
  importerName?: string;
  importDivisionCode?: string;
}

export interface LotteOnBuildContext {
  input: LotteOnPayloadInput;
  identityError: string | null;
}

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * 상세페이지 HTML을 만든다. 판매자 프로필/템플릿/브랜드는 기존 쿠팡용 저장소를
 * 그대로 재사용한다(Naver가 이미 같은 값을 재사용하는 선례 — 새 DB 컬럼을
 * 만들지 않는다).
 */
async function buildDetailHtml(product: CanonicalProduct): Promise<string> {
  const sellerProfile = await getDefaultSellerProfile();
  const descriptionTemplate = await getDefaultDescriptionTemplate();
  const brandProfile = await findBrandProfileByName(product.brand.value);

  const productImageUrls = product.images
    .filter((image) => image.useInDescription && image.classification === "PRODUCT")
    .map((image) => (image.selectedVariant === "PROCESSED" && image.processedUrl ? image.processedUrl : image.originalUrl));
  const sizeChartImageUrls = product.images
    .filter((image) => image.classification === "SIZE_CHART")
    .map((image) => image.originalUrl);

  return assembleNaverDetailContent(resolveDetailBlocks(sellerProfile?.defaultDetailBlocks), {
    aiDescription: product.descriptionKo.value || product.description.value,
    template: descriptionTemplate,
    commonImages: {
      topCommonImageUrl: sellerProfile?.topCommonImageUrl ?? null,
      topCommonImageEnabled: sellerProfile?.topCommonImageEnabled ?? false,
      bottomCommonImageUrl: sellerProfile?.bottomCommonImageUrl ?? null,
      bottomCommonImageEnabled: sellerProfile?.bottomCommonImageEnabled ?? false,
    },
    productImageUrls,
    sizeChartImageUrls,
    brandIntro: brandProfile?.brandIntro ?? null,
  });
}

export async function buildLotteOnContext(
  product: CanonicalProduct,
  form: LotteOnChannelFormInput,
  options?: { liveRates?: Record<string, number>; roundingUnit?: number; now?: Date },
): Promise<LotteOnBuildContext> {
  // 거래처 정보는 저장하지 않고 매번 207로 조회한다 — 인증키를 교체했을 때
  // 옛 거래처로 조용히 등록되는 일을 막는다.
  const identity = await fetchLotteOnIdentity();
  const period = buildLotteOnSalePeriod(options?.now ?? new Date());

  const channel: LotteOnChannelConfig = {
    ...BLANK_LOTTEON_CHANNEL_CONFIG,
    ...period,
    trGrpCd: identity.ok ? identity.identity.trGrpCd : null,
    trNo: identity.ok ? identity.identity.trNo : null,

    standardCategoryNo: trimOrNull(form.standardCategoryNo),
    // 일반 셀러의 몰구분코드는 롯데ON(LTON) 하나다(문서 MALL_DVS_CD).
    displayCategories: (form.displayCategoryNos ?? [])
      .map((no) => no.trim())
      .filter(Boolean)
      .map((lfDcatNo) => ({ mallCd: "LTON", lfDcatNo })),

    originCode: trimOrNull(form.originCode),
    taxTypeCode: trimOrNull(form.taxTypeCode) ?? "01",

    noticeItemCode: trimOrNull(form.noticeItemCode),
    noticeArticles: (form.noticeArticles ?? []).filter((a) => a.pdArtlCd?.trim() && a.pdArtlCnts?.trim()),
    safetyCertifications: (form.safetyCertifications ?? []).filter((c) => c.sftyAthnTypCd?.trim() && c.sftyAthnNo?.trim()),
    importProxyCode: trimOrNull(form.importProxyCode),

    brandNo: trimOrNull(form.brandNo),

    outboundPlaceNo: trimOrNull(form.outboundPlaceNo),
    returnPlaceNo: trimOrNull(form.returnPlaceNo),
    deliveryCostPolicyNo: trimOrNull(form.deliveryCostPolicyNo),
    deliveryRegionGroupCode: trimOrNull(form.deliveryRegionGroupCode),
    courierCode: trimOrNull(form.courierCode),
    returnCourierCode: trimOrNull(form.returnCourierCode),

    shipBudgetDays: typeof form.shipBudgetDays === "number" ? form.shipBudgetDays : 3,
    weekdayCloseTime: trimOrNull(form.weekdayCloseTime) ?? "1400",
    saturdayShippingAvailable: Boolean(form.saturdayShippingAvailable),
    saturdayCloseTime: trimOrNull(form.saturdayCloseTime),

    externalProductNo: trimOrNull(form.externalProductNo),
    importerName: trimOrNull(form.importerName),
    importDivisionCode: trimOrNull(form.importDivisionCode),
  };

  return {
    input: {
      product,
      channel,
      detailHtml: await buildDetailHtml(product),
      liveRates: options?.liveRates,
      roundingUnit: options?.roundingUnit,
    },
    identityError: identity.ok ? null : identity.message,
  };
}
