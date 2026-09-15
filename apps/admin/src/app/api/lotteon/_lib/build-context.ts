import type { CanonicalProduct } from "@commerce/shared";
import {
  assembleNaverDetailContent,
  resolveDetailBlocks,
  resolveLotteOnShipBudgetDays,
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnSalePeriod,
  type LotteOnChannelConfig,
  type LotteOnPayloadInput,
  type LotteOnSellerSettingsInput,
} from "@commerce/listing";
import { getDefaultSellerProfile, type SellerProfile } from "../../coupang/_lib/seller-profile";
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
 * SellerProfile(어드민 DB 모양) → 롯데ON이 읽는 부분집합.
 *
 * 화면(CommerceWorkspace)도 같은 모양을 만들어 패널에 내려준다 — 두 곳이 같은
 * 타입을 만들게 해서 "화면에는 반영됐다고 적혀 있는데 payload는 다른 값"이
 * 생기지 않게 한다.
 */
export function toLotteOnSellerSettings(profile: SellerProfile | null): LotteOnSellerSettingsInput | null {
  if (!profile) return null;
  return {
    outboundLeadTimeDays: profile.outboundLeadTimeDays,
    deliveryCompanyCode: profile.deliveryCompanyCode,
    naverDeliveryCompanyCode: profile.naverDeliveryCompanyCode,
    outboundShippingPlaceCode: profile.outboundShippingPlaceCode,
    returnCenterCode: profile.returnCenterCode,
    topCommonImageEnabled: profile.topCommonImageEnabled,
    bottomCommonImageEnabled: profile.bottomCommonImageEnabled,
  };
}

/**
 * 상세페이지 HTML을 만든다. 판매자 프로필/템플릿/브랜드는 기존 쿠팡용 저장소를
 * 그대로 재사용한다(Naver가 이미 같은 값을 재사용하는 선례 — 새 DB 컬럼을
 * 만들지 않는다).
 */
async function buildDetailHtml(
  product: CanonicalProduct,
  sellerProfile: SellerProfile | null,
  /* REWORK-10 A — 호출부가 이미 읽어 둔 브랜드 프로필을 그대로 받는다(여기서
     다시 조회하면 같은 요청 안에서 DB를 두 번 왕복한다). */
  brandProfile: { brandIntro: string } | null,
): Promise<string> {
  const descriptionTemplate = await getDefaultDescriptionTemplate();

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
  /**
   * REWORK 커머스 탭 구조 통일(CEO 지시, 2026-09-14) — 셀러 설정을 **한 번만**
   * 읽어서 상세페이지 조립과 배송값 판정이 같은 프로필을 보게 한다. 예전에는
   * buildDetailHtml() 안에서만 읽었고, 그래서 배송 쪽은 셀러 설정을 아예 모른
   * 채 상수를 썼다(sndBgtNday: 3 고정).
   */
  const sellerProfile = await getDefaultSellerProfile();
  /**
   * REWORK-10 A(CEO 지시, 2026-09-15) — 제조사 폴백을 위해 브랜드 프로필을
   * **여기서** 한 번 읽는다. buildDetailHtml() 안에서만 읽던 값이라 payload
   * 쪽에서는 쓸 수가 없었다 — 그래서 롯데ON만 브랜드 프로필의 제조사를 모른 채
   * mfcrNm을 비워 보내고 있었다. 조회는 그대로 한 번이다(아래 buildDetailHtml에
   * 인자로 넘겨서 같은 값을 재사용한다 — DB 왕복이 늘지 않는다).
   */
  const brandProfile = await findBrandProfileByName(product.brand.value);

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

    /**
     * 발송예정일수 — **셀러 설정의 "출고 소요일"이 그대로 온다.**
     *
     * 설정 화면이 그 값을 "배송비/출고 소요일은 두 플랫폼에 동일하게 적용됩니다"
     * 라고 말하고 있다 = 코드체계가 없는 플랫폼 중립 값이다. 롯데ON만 그것을
     * 무시하고 상수 3을 쓰던 자리를, 스마트스토어·쿠팡과 같은 출처로 맞춘다.
     * 상한(일반상품 3일) 처리는 resolveLotteOnShipBudgetDays() 한 곳에만 있다.
     */
    shipBudgetDays:
      typeof form.shipBudgetDays === "number"
        ? form.shipBudgetDays
        : resolveLotteOnShipBudgetDays(toLotteOnSellerSettings(sellerProfile)).days,
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
      detailHtml: await buildDetailHtml(product, sellerProfile, brandProfile),
      /* REWORK-10 A — 제조사 폴백(① 상품 원문 → ② 브랜드 프로필 → ③ 판매자
         기본정보). 판정은 buildLotteOnPayload 안의 공통 resolveManufacturer()가
         한다 — 여기서는 값을 읽어 넘기기만 한다. */
      brandProfileManufacturer: brandProfile?.manufacturer ?? null,
      sellerProfileManufacturer: sellerProfile?.manufacturer ?? null,
      liveRates: options?.liveRates,
      roundingUnit: options?.roundingUnit,
    },
    identityError: identity.ok ? null : identity.message,
  };
}
