import {
  assembleNaverDetailContent,
  resolveProductDetailBlocks,
  type ProductDetailOverride,
  resolveLotteOnShipBudgetDays,
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnSalePeriod,
  type LotteOnChannelConfig,
  type LotteOnPayloadInput,
  type LotteOnSellerSettingsInput,
  type LotteOnProductInput,
  resolveLotteOnNotice,
  resolveCommonOrigin,
  /* 🔴 LOTTEON-FINAL-06 2순위 — 「상세페이지 참조」 판정은 이미 있는 공통
     모듈 하나가 한다. 롯데ON 이 제 기준을 새로 만들지 않는다. */
  resolveNoticeFieldValue,
  type LotteOnNoticeResolution,
} from "@commerce/listing";
import type { ProvenanceField } from "@commerce/shared";
import { getDefaultSellerProfile, type SellerProfile } from "../../coupang/_lib/seller-profile";
import { SELLER_SETTINGS_UNAVAILABLE_MESSAGE, loadSellerSettings } from "@/lib/seller-settings";
import { getDefaultDescriptionTemplate } from "../../coupang/_lib/description-template";
import { findBrandProfileByName } from "../../coupang/_lib/brand-profile";
import { loadLotteOnSellerSettings, resolveLotteOnSellerFixedValue } from "./seller-settings";
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
  /** LOTTEON-FINAL-05 #2 — 판매자가 신고한 안전인증 대상 여부. 🔴 키가 없으면
   * 미선택이다(「대상 아님」이 아니다). */
  safetyTarget?: "TARGET" | "EXCLUDED";
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
  /**
   * 고시 13항목이 각각 «어떻게 됐는지». 🔴 화면이 다시 판정하지 않게 하려고
   * 여기 싣는다 — payload 를 만든 «바로 그» 계산 결과다.
   *
   * STEP3-FIX 에서 배운 것이다: 화면이 제 나름대로 판정하면 「payload 로는
   * 가는데 화면에는 없는」 상태가 생긴다. 출처를 하나로 둔다.
   */
  notice: LotteOnNoticeResolution;
  /* PIVOT-03 R6-FS — identityError 와 «같은 모양» 이다. 새 오류 계층을 만들지
     않는다: null 이면 정상, 문자열이면 그 이유다.
     🔴 「판매자 정보가 비었다」가 아니라 「읽지 못했다」일 때만 채워진다. */
  sellerSettingsError: string | null;
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
  product: LotteOnProductInput,
  sellerProfile: SellerProfile | null,
  /* REWORK-10 A — 호출부가 이미 읽어 둔 브랜드 프로필을 그대로 받는다(여기서
     다시 조회하면 같은 요청 안에서 DB를 두 번 왕복한다). */
  brandProfile: { brandIntro: string } | null,
  /** PRODUCT-INFO-UX-06 — 상품별 override. 없으면 기존과 동일하다. */
  detailOverride?: ProductDetailOverride | null,
): Promise<string> {
  const descriptionTemplate = await getDefaultDescriptionTemplate();

  const productImageUrls = product.images
    .filter((image) => image.useInDescription && image.classification === "PRODUCT")
    .map((image) => (image.selectedVariant === "PROCESSED" && image.processedUrl ? image.processedUrl : image.originalUrl));
  const sizeChartImageUrls = product.images
    .filter((image) => image.classification === "SIZE_CHART")
    .map((image) => image.originalUrl);

  return assembleNaverDetailContent(resolveProductDetailBlocks(sellerProfile?.defaultDetailBlocks, detailOverride), {
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

/**
 * 폼이 먼저, 공통이 빈 칸을 채운다 — 배송 사다리와 «같은 순서» 다.
 *
 * 🔴 셀러가 이 상품에서 직접 확정한 항목을 공통값이 덮지 않는다. 그리고
 * 공통에서 온 항목이라도 폼에 없는 «코드» 일 때만 들어간다.
 */
function mergeNoticeArticles(
  fromForm: { pdArtlCd: string; pdArtlCnts: string }[],
  fromCommon: { pdArtlCd: string; pdArtlCnts: string }[],
): { pdArtlCd: string; pdArtlCnts: string }[] {
  const taken = new Set(fromForm.map((article) => article.pdArtlCd.trim()));
  return [...fromForm, ...fromCommon.filter((article) => !taken.has(article.pdArtlCd.trim()))];
}

export async function buildLotteOnContext(
  /* NEXT-04d Phase B-1 — 라우트도 같은 경계를 쓴다. 롯데ON 전용 값은 이미
     `form`(LotteOnChannelFormInput)으로 들어오므로, 상품 쪽에서 채널 칸을
     읽을 «수 있어야 할» 이유가 없다. */
  product: LotteOnProductInput,
  form: LotteOnChannelFormInput,
  options?: {
    liveRates?: Record<string, number>;
    roundingUnit?: number;
    now?: Date;
    /** PRODUCT-INFO-UX-06 — 상품별 상세페이지 override. 없으면 기존과 동일. */
    detailOverride?: ProductDetailOverride | null;
  },
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
   * PIVOT-03 ⑨ 0-2 — 제조사 «한 칸» 의 출처만 seller_settings 로 옮긴다.
   *
   * 🔴 위의 sellerProfile 조회는 그대로 둔다. 이 파일이 쓰는 나머지(배송값 ·
   * 상세페이지 조립)는 전부 배송 프로필의 것이고 프로필마다 달라야 하는
   * 값이다. 치환이 아니라 출처 분리다.
   *
   * 🔴 폴백 순서는 건드리지 않는다. 판정은 아래 buildLotteOnPayload 안의
   * 공통 resolveManufacturer()가 그대로 한다 — 여기는 값을 읽어 넘기기만 한다.
   *
   * 🔴 이름을 `commonSellerSettings`로 길게 쓴 이유: 이 파일에는 아래에 이미
   * `sellerSettings`(loadLotteOnSellerSettings)가 있다. 이름은 거의 같은데
   * 뜻이 반대다.
   *
   *     commonSellerSettings  전 채널 공통 판매자 정보(제조사 등)
   *     sellerSettings        롯데ON «전용» 번호(출고지·반품지·배송비정책)
   *
   * 뒤엣것은 다른 채널로 옮길 수 없는 값이라 절대 섞이면 안 된다.
   */
  const commonSellerSettings = await loadSellerSettings();
  /**
   * REWORK-10 A(CEO 지시, 2026-09-15) — 제조사 폴백을 위해 브랜드 프로필을
   * **여기서** 한 번 읽는다. buildDetailHtml() 안에서만 읽던 값이라 payload
   * 쪽에서는 쓸 수가 없었다 — 그래서 롯데ON만 브랜드 프로필의 제조사를 모른 채
   * mfcrNm을 비워 보내고 있었다. 조회는 그대로 한 번이다(아래 buildDetailHtml에
   * 인자로 넘겨서 같은 값을 재사용한다 — DB 왕복이 늘지 않는다).
   */
  const brandProfile = await findBrandProfileByName(product.brand.value);

  /* LOTTEON-REAL-REGISTRATION-02 — 롯데ON 판매자 고정값(출고지·반품지·배송비
     정책·배송가능지역·발송마감시간). 조회 실패는 «설정 없음» 과 같은 얼굴로
     돌아오므로 여기서 등록을 막지 않는다 — 비어 있으면 검증기가 평소대로
     SELLER_PLACE_REQUIRED 로 말한다. */
  const sellerSettings = await loadLotteOnSellerSettings();
  /** 사다리를 한 곳에서만 말한다 — 규칙이 여러 줄에 흩어지면 한 줄만 뒤집힌다. */
  const fixed = (formValue: string | null | undefined, settingValue: string | null) =>
    resolveLotteOnSellerFixedValue(formValue, settingValue).value;

  /* 고시 항목을 «이미 가진 값» 으로 푼다. 값을 만들지는 않는다 —
     resolver 가 FILLED / NEEDS_INPUT / BLOCKED 를 구분해서 돌려준다. */
  /* ══ LOTTEON-FINAL-06 2순위(CPO 지시, 2026-09-29) — 「상품 상세페이지 참조」 ══
     공통 상품정보 탭의 「선택 N건 상세페이지 참조로 일괄 등록」은 **값을 비우고
     `source` 만 `DETAIL_PAGE_REFERENCE` 로 바꾼다.** 그런데 롯데ON 은 여기서
     `product.X.value` «만» 읽고 있어서, 셀러가 참조 처리를 한 칸이 롯데ON 에서는
     그냥 «빈 값» 이었다 — 쿠팡·스마트스토어에서는 참조로 등록되는 같은 상품이
     롯데ON 고시에서만 통째로 빠졌다(실측: 0020 색상 · 0410 소재 · 0070 제조사가
     FILLED → NEEDS_INPUT 으로 후퇴).

     🔴 **새 화이트리스트를 만들지 않는다.** 판정은 이미 있는 공통 모듈
     (`packages/listing/src/notice/reference-eligibility.ts`) 한 곳에 있고,
     여기서는 그것을 «부르기만» 한다. 두 곳에 두면 채널마다 기준이 갈라진다.

     🔴 KC 는 이 길로 오지 않는다. `certificationType`/`childCertification` 은
     화이트리스트에 «영구 제외» 돼 있고(N-3.45 STEP10), 롯데ON 고시 `0200` 은
     별도 축(안전인증 3상태)이 닫는다 — 실제 인증 취득 여부를 모르는 채
     「상세페이지 참조」로 얼버무리면 규제 위반이다.
     🔴 원산지(`0060`)도 이 길이 아니다. 화이트리스트에 없고, 바로 아래
     `resolveCommonOrigin` 사다리가 따로 본다. */
  const referenced = (key: Parameters<typeof resolveNoticeFieldValue>[0], value: ProvenanceField<string>) =>
    resolveNoticeFieldValue(key, value) ?? "";

  const noticeResolution = resolveLotteOnNotice(trimOrNull(form.noticeItemCode), {
    color: referenced("color", product.color),
    material: referenced("material", product.material),
    /* ══ COMMERCE-COMMON-WIRE-01 ══════════════════════════════════════════
       고시 「제조국」도 쿠팡·스마트스토어와 «같은 사다리» 를 본다. 여기만
       상품 값을 직접 읽고 있어서, 브랜드·판매자 기본값이 있어도 비었다.
       🔴 이것은 롯데ON 에서는 «동작 변화» 다 — 다만 등록 건수가 0이라
       깨질 Production 이 없고, 세 채널이 같은 값을 보게 하는 쪽이 맞다. */
    countryOfOrigin: resolveCommonOrigin({
      product: { value: product.countryOfOrigin.value, source: product.countryOfOrigin.source },
      brandDefault: brandProfile?.countryOfOrigin,
      sellerDefault: commonSellerSettings.defaultCountryOfOrigin,
    }).value,
    /* 🔴 옵션에서 «치수» 만 고른다. 공식 가이드라인이 품목 23 의 크기·중량을
       「섬유제품 등의 경우 치수 정보로 대체 가능」이라고 적어 둔 그 자리다.
       사용연령으로는 넘기지 않는다 — 사이즈 축과 연령 축은 다르다. */
    sizeValues: product.optionGroups
      .filter((group) => /size|사이즈/i.test(group.name))
      .flatMap((group) => group.values),
    weight: referenced("weight", product.weight),
    careInstructions: referenced("careInstructions", product.careInstructions),
    /* 🔴 상품의 제조사«만»이다. 공통 판매자 설정의 제조사 칸으로 폴백하지
       않는다 — 처음에 그렇게 썼다가 PIVOT NEXT-04c-2 가드에 잡혔다.
       판매 사업자를 제조사로 쓰지 않는다는 것은 이미 끝난 사안이고,
       고시의 「제조자」는 법률상 정보라 특히 그렇다.

       🔴 그 칸 이름을 여기 «적지도» 않는다 — 가드가 소스를 문자열로 읽기
       때문에, 「쓰지 않는다」고 설명한 주석조차 사용으로 잡힌다(실제로 잡혔다). */
    manufacturer: referenced("manufacturer", product.manufacturer),
    importer: referenced("importer", product.importer),
    itemName: referenced("itemName", product.itemName),
    modelName: referenced("modelName", product.modelName),
    recommendedAge: referenced("recommendedAge", product.recommendedAge),
    kcCertificationNumber: product.childCertification.value?.certificationNumber ?? null,
    /* 🔴 LOTTEON-FINAL-05 #2 — 롯데ON 의 KC 문은 «둘» 이다(sftyAthnLst · 고시
       0200). 같은 신고를 resolver 에도 줘야 「대상 아님」을 고른 셀러가 뒤쪽
       문에서 다시 막히지 않는다 — 한쪽만 열면 화면이 거짓말을 하게 된다. */
    safetyTarget: form.safetyTarget ?? null,
    /* ══ LOTTEON-NOTICE-SELLER-CONFIRMATION-01 ═════════════════════════════
       셀러가 화면에서 채운 고시 값. 🔴 **새 전송 필드를 만들지 않았다** — 화면은
       이미 `noticeArticles` 로 보내고 있었고, 아래 `mergeNoticeArticles` 가 그것을
       payload 에 «폼 우선» 으로 얹는다. 그런데 resolver 는 그 값을 보지 못해서,
       payload 에는 값이 가는데 화면은 「입력 필요」로 남았다. 같은 입력을
       resolver 에도 줘서 그 «갈라짐» 을 없앤다.

       🔴 화이트리스트(0220·1830) 밖의 키를 여기서 걸러내지 «않는다» — 판정은
       resolver 한 곳에만 둔다. 필터를 두 곳에 두면 한쪽만 조용히 넓어진다. */
    sellerArticleValues: Object.fromEntries(
      (form.noticeArticles ?? [])
        .filter((a) => a.pdArtlCd?.trim() && a.pdArtlCnts?.trim())
        .map((a) => [a.pdArtlCd.trim(), a.pdArtlCnts.trim()]),
    ),
    sellerQualityGuarantee: commonSellerSettings.qualityGuarantee,
    sellerAsContactNumber: commonSellerSettings.asContactNumber,
    /* 🔴 LOTTEON-NOTICE-FIELD-IMPLEMENT-0090-01 — 칸이 생겼다(migration 068).
       고시 `0090` 은 「업체명과 전화번호를 «모두»」를 요구하므로 둘이 한 쌍이다.
       🔴 비어 있으면 «비운 채로» 넘긴다 — `manufacturer` 나 판매자명으로 대신
       넣지 않는다(CPO 명시). 그 경우 이 항목은 그대로 BLOCKED 로 남는다. */
    sellerAsCompanyName: commonSellerSettings.asCompanyName,
    /* 🔴 COMMON-AS-PHONE-SEPARATION-01 — 번호는 «번호 칸» 에서만 온다.
       `asContactNumber`(안내 문구)도 반품지 연락처도 여기로 끌어오지 않는다. */
    sellerAsPhoneNumber: commonSellerSettings.asPhoneNumber,
  });

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
    /* 🔴 ②(CPO 확정) — `?? "01"` 이었다. 205 가 tdf_cd 를 주지 않거나 셀러가
       카테고리 번호를 직접 넣은 경우에 «과세» 가 조용히 실려 나갔다.
       비면 빈 문자열로 두고 검증기가 막는다 — UNKNOWN 을 01 로 바꾸지 않는다. */
    taxTypeCode: trimOrNull(form.taxTypeCode) ?? "",

    noticeItemCode: trimOrNull(form.noticeItemCode),
    /* ══ LOTTEON-REGISTRATION-01(CPO 전환 지시, 2026-09-28) ═════════════════
       고시 항목이 **공통 값에서 자동으로** 채워지는 자리.

       여기까지 오는 데 오래 걸렸다. 우리는 「항목코드를 얻을 길이 없다」고
       적어 뒀는데, 근거가 «우리가 지어낸 코드그룹 이름» 이었다. 실제로는
       롯데ON 이 품목별 항목표를 공식 문서로 게시하고 있었다(notice-schema.ts).

       🔴 순서는 배송과 «같다» — 폼이 먼저고 공통이 빈 칸을 채운다. 아래 `fixed()`
       사다리와 같은 규칙이라, 화면이 그 사다리를 그대로 비추면 「payload 로는
       가는데 화면에는 없는」 상태가 생기지 않는다(STEP3-FIX 에서 겪은 것). */
    noticeArticles: mergeNoticeArticles(
      (form.noticeArticles ?? []).filter((a) => a.pdArtlCd?.trim() && a.pdArtlCnts?.trim()),
      noticeResolution.articles,
    ),
    /* 🔴 신고를 그대로 넘긴다. 여기서 「EXCLUDED 면 인증 목록을 비운다」 같은
       정리를 «하지 않는다» — 그러면 셀러가 둘 다 넣은 모순을 검증기가 볼 수
       없게 되고, 화면에는 인증정보가 남았는데 payload 에서는 사라지는 갈라짐이
       생긴다. 모순은 지우는 것이 아니라 막는 것이다. */
    safetyTarget: form.safetyTarget ?? null,
    safetyCertifications: (form.safetyCertifications ?? []).filter((c) => c.sftyAthnTypCd?.trim() && c.sftyAthnNo?.trim()),
    importProxyCode: trimOrNull(form.importProxyCode),

    brandNo: trimOrNull(form.brandNo),

    /* ══ LOTTEON-REAL-REGISTRATION-02 §3~§5(CEO 확정, 2026-09-22) ══

       판매자 «고정값» 이 여기서 합류한다. 이 네 개는 롯데ON 판매자센터에 먼저
       등록돼 있어야 하는 번호라 우리가 만들 수 없고(validate-payload 의
       SELLER_PLACE_REQUIRED), 판매자가 바꾸지 않는 한 상품마다 달라지지도
       않는다. 그런데 저장할 곳이 없어서 **상품별 폼에만** 살았다 — 그래서 매
       상품마다 다시 골라야 했다.

       🔴 사다리 순서를 지킨다: **상품 폼이 먼저다.** 설정은 폼이 비었을 때만
       들어온다. 셀러가 이 상품에서만 다른 출고지를 골랐다면 그 결정이 설정에
       덮이면 안 된다(제조사 사다리와 같은 원칙).

       🔴 기존 autoPick(후보가 «정확히 하나» 일 때만 자동 선택)에 기대지 않는다.
       출고지가 두 곳인 판매자에게 그 규칙은 아무 도움이 안 됐다. */
    outboundPlaceNo: fixed(form.outboundPlaceNo, sellerSettings.outboundPlaceNo),
    returnPlaceNo: fixed(form.returnPlaceNo, sellerSettings.returnPlaceNo),
    deliveryCostPolicyNo: fixed(form.deliveryCostPolicyNo, sellerSettings.deliveryCostPolicyNo),
    deliveryRegionGroupCode: fixed(form.deliveryRegionGroupCode, sellerSettings.deliveryRegionGroupCode),
    /* ══ 장기 스프린트 S-9(CEO 정책 결정, 2026-09-26) ══
       택배사·반품택배사도 «사다리» 를 탄다. 지금까지 이 둘만 `trimOrNull(form…)`
       이라 상품 폼이 비면 그대로 비었고 셀러는 상품마다 다시 골라야 했다
       (C-2A 가 이 비대칭을 찾았고 E2E 가 반복 비용을 확인했다).

       🔴 순서는 위 네 값과 «같다»: 상품 폼이 먼저다. 이 상품에서만 다른 택배사를
       골랐다면 설정이 그 결정을 덮지 않는다. */
    courierCode: fixed(form.courierCode, sellerSettings.courierCode),
    returnCourierCode: fixed(form.returnCourierCode, sellerSettings.returnCourierCode),

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
    /* §3 — 발송마감시간도 판매자 운영시간이라 상품마다 달라지지 않는다.
       폼 → 판매자 설정 → 기존 기본값("1400") 순서다. 기본값을 없애지 않는다 —
       설정이 비어 있던 상품들의 동작이 이 변경으로 달라지면 안 된다. */
    weekdayCloseTime: fixed(form.weekdayCloseTime, sellerSettings.weekdayCloseTime) ?? "1400",
    saturdayShippingAvailable: Boolean(form.saturdayShippingAvailable),
    saturdayCloseTime: fixed(form.saturdayCloseTime, sellerSettings.saturdayCloseTime),

    externalProductNo: trimOrNull(form.externalProductNo),
    importerName: trimOrNull(form.importerName),
    importDivisionCode: trimOrNull(form.importDivisionCode),
  };

  return {
    input: {
      product,
      channel,
      detailHtml: await buildDetailHtml(product, sellerProfile, brandProfile, options?.detailOverride),
      /* REWORK-10 A — 제조사 폴백(① 상품 원문 → ② 브랜드 프로필 → ③ 판매자
         기본정보). 판정은 buildLotteOnPayload 안의 공통 resolveManufacturer()가
         한다 — 여기서는 값을 읽어 넘기기만 한다. */
      brandProfileManufacturer: brandProfile?.manufacturer ?? null,
      /* 🔴 PIVOT NEXT-04c-2 — 판매자 기본정보를 제조사로 넘기던 줄이 사라졌다.
         seller_settings.manufacturer 에 실제로 들어 있는 것은 «판매 사업자»
         (규하맘샵)이고, 판매자라는 이유만으로 제조자가 되지 않는다. 컬럼
         이름이 legacy 라 그렇게 보였을 뿐이다(PIVOT-03 직후라 이름은 그대로 둔다). */
      liveRates: options?.liveRates,
      roundingUnit: options?.roundingUnit,
    },
    identityError: identity.ok ? null : identity.message,
    /* 🔴 값이 비어서가 아니라 «읽지 못해서» 채워진다. 소비자(register/preview)가
       이 값을 보고 멈춘다 — 여기서 throw 하지 않는 이유는 preview 가 부분
       정보라도 보여줘야 하기 때문이다(identityError 와 같은 판단). */
    sellerSettingsError: commonSellerSettings.failed ? SELLER_SETTINGS_UNAVAILABLE_MESSAGE : null,
    notice: noticeResolution,
  };
}
