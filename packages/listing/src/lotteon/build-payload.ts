import type { MasterProduct, SellingConditions } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import { computeVariantFinalPriceKrw, resolveListingPrice } from "@commerce/pricing";
import { manufacturerInputFromProduct, resolveManufacturer } from "../common/manufacturer";
import type {
  LotteOnCategoryAttribute,
  LotteOnDisplayCategory,
  LotteOnItem,
  LotteOnItemImage,
  LotteOnItemOption,
  LotteOnNoticeArticle,
  LotteOnOptionSort,
  LotteOnProductRegistration,
  LotteOnProductRegistrationPayload,
  LotteOnSafetyCertification,
} from "./types";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 3 — CanonicalProduct → 롯데ON 상품등록(87) payload.
 *
 * 3층 모델을 그대로 지킨다: `CanonicalProduct` → `ListingModel`(Preview) →
 * 이 payload. **CanonicalProduct는 한 줄도 바뀌지 않는다** — 롯데ON에만 있는
 * 값은 전부 아래 `LotteOnPayloadInput.channel`(채널 전용 입력)에 담는다.
 * Naver가 addressBookNo/originAreaCode/childCertificationInfoId를
 * `NaverPayloadInput`에 담는 선례를 그대로 따른다.
 *
 * 가격: 새 가격 경로를 만들지 않는다. 기존 단일 출처인 `resolveListingPrice()`
 * 하나만 부르고, 옵션 차액은 `computeVariantFinalPriceKrw()`로 계산한다
 * (Naver build-payload.ts와 동일). 단, 롯데ON `itmLst[].slPrc`는 차액이 아니라
 * **절대 판매가**다 — Naver optionCombinations.price(차액)와 반대라 여기서만
 * 최종가를 그대로 싣는다.
 *
 * ── NEXT-04d Phase B-1(CPO 승인, 2026-09-23) — 이 파일이 «볼 수 있는» 것 ──
 * 입력 타입이 `CanonicalProduct` 에서 `LotteOnProductInput`(= Master + 판매
 * 조건)으로 좁혀졌다. 저장 구조는 한 바이트도 바뀌지 않았다 — 호출부는 지금도
 * `CanonicalProduct` 를 그대로 넘기고, 구조적 타이핑이 그것을 받는다.
 *
 * 바뀐 것은 «읽을 수 있는 범위» 다. 이제 이 파일 안에서
 * `product.lotteOnChannelInfo` 를 읽으면 **타입 에러가 난다.** 채널 값은
 * 반드시 `channel`(LotteOnChannelConfig)로 들어와야 한다 — 그래야 Master 가
 * 커머스를 모르는 상태가 유지된다.
 *
 * 🔴 이 함수는 값을 **지어내지 않는다.** 채널 전용 값(표준/전시 카테고리,
 * 고시 항목, 안전인증, 출고지/반품지/배송비정책 번호 등)이 없으면 그 자리를
 * 빈 값으로 두고 validate-payload.ts가 MISSING/BLOCKED로 잡는다. 임의의 기본값을
 * 넣어 "성공한 것처럼 보이는 등록"을 만들지 않는다.
 */

/**
 * NEXT-04d Phase A/B-1 — 롯데ON 빌더가 상품에서 «볼 수 있는» 범위.
 *
 *   MasterProduct       이 상품은 무엇인가(core · facts · variants · attributes
 *                       · content · source)
 *   SellingConditions   우리가 어떤 조건으로 파는가(판매가 · 배송비 · 반품)
 *
 * 🔴 `CommerceBinding` 이 «없다». lotteOnChannelInfo · channelPriceOverrides ·
 * categoryFieldOverrides 는 이 타입에 존재하지 않으므로 이 파일에서 읽을 수
 * 없다. 롯데ON 전용 값은 아래 `LotteOnChannelConfig` 한 통로로만 들어온다.
 */
export type LotteOnProductInput = MasterProduct & SellingConditions;

/** 롯데ON에만 있는, 상품 데이터에서 파생할 수 없는 값 전부. */
export interface LotteOnChannelConfig {
  /** 207 Identity가 주는 거래처 정보. 서버가 등록 직전에 조회해서 채운다. */
  trGrpCd: string | null;
  trNo: string | null;
  lrtrNo?: string | null;

  /** 표준카테고리번호(scatNo). onpick-api 205로 조회한다. */
  standardCategoryNo: string | null;
  /** 전시카테고리 목록(dcatLst). 표준카테고리에 매핑된 것 중 **1개 이상** 필수. */
  displayCategories: LotteOnDisplayCategory[];

  /** 원산지코드(oplcCd) [공통코드 OPLC_CD]. 텍스트에서 추론하지 않는다. */
  originCode: string | null;
  /** 과세유형코드(tdfDvsCd). 일반 과세상품은 "01". */
  taxTypeCode: string;

  /** 상품품목코드(pdItmsCd). 23 = 어린이제품(유아동). */
  noticeItemCode: string | null;
  /** 고시 항목들. pdArtlCd 코드체계는 품목마다 달라 생성하지 않는다. */
  noticeArticles: LotteOnNoticeArticle[];

  /** 안전인증목록(sftyAthnLst). 품목코드 23에서는 표준카테고리에 따라 필수. */
  safetyCertifications: LotteOnSafetyCertification[];
  /** 수입대행코드(impPrxCd) — KC인증 계열을 넣을 때 필수. */
  importProxyCode: string | null;

  /** 표준카테고리 속성(scatAttrLst) — 속성모듈(203)이 준 값만. */
  categoryAttributes: LotteOnCategoryAttribute[];

  /** 브랜드번호(brdNo) — 속성모듈(204)이 준 값. 없으면 생략(문자열 브랜드명은
   * 이 필드에 들어가지 않는다). */
  brandNo: string | null;

  /** 거래처 API로 선등록된 번호들. 우리가 만들 수 없는 값이다. */
  outboundPlaceNo: string | null;
  returnPlaceNo: string | null;
  deliveryCostPolicyNo: string | null;
  /** 배송가능지역코드(dvRgsprGrpCd) [공통코드 DV_RGSPR_GRP_CD]. */
  deliveryRegionGroupCode: string | null;

  /** 택배사코드(hdcCd/rtngHdcCd) [공통코드 DV_CO_CD]. */
  courierCode: string | null;
  returnCourierCode: string | null;

  /** 발송예정일수(sndBgtNday) — 배송상품유형별 상한이 있다(일반상품 3일). */
  shipBudgetDays: number;
  /** 평일 발송마감시간 [HH24MI], 00/30분만. */
  weekdayCloseTime: string;
  saturdayShippingAvailable: boolean;
  saturdayCloseTime?: string | null;

  /** 판매 기간 [YYYYMMDDHH24MISS]. */
  saleStartDttm: string;
  saleEndDttm: string;

  /** 업체상품번호(epdNo) — 우리 쪽 식별자. jobKey/sku 등에서 만든다. */
  externalProductNo: string | null;

  /** 해외 구매대행이면 수입사명/수입구분코드를 싣는다. */
  importerName?: string | null;
  importDivisionCode?: string | null;
}

/** 아직 아무것도 설정되지 않은 채널 설정 — Preview/검증이 "무엇이 비었는지"를
 * 보여줄 때 쓴다(Coupang BLANK_COUPANG_SELLER_CONFIG와 같은 역할). */
export const BLANK_LOTTEON_CHANNEL_CONFIG: LotteOnChannelConfig = {
  trGrpCd: null,
  trNo: null,
  standardCategoryNo: null,
  displayCategories: [],
  originCode: null,
  taxTypeCode: "01",
  noticeItemCode: null,
  noticeArticles: [],
  safetyCertifications: [],
  importProxyCode: null,
  categoryAttributes: [],
  brandNo: null,
  outboundPlaceNo: null,
  returnPlaceNo: null,
  deliveryCostPolicyNo: null,
  deliveryRegionGroupCode: null,
  courierCode: null,
  returnCourierCode: null,
  shipBudgetDays: 3,
  weekdayCloseTime: "1400",
  saturdayShippingAvailable: false,
  saleStartDttm: "",
  saleEndDttm: "",
  externalProductNo: null,
};

export interface LotteOnPayloadInput {
  product: LotteOnProductInput;
  channel: LotteOnChannelConfig;
  /** 상세페이지 HTML(상품기술서). 조립은 기존 공통 경로가 하고 이 함수는 받기만 한다. */
  detailHtml: string;
  /**
   * REWORK-10 A(CEO 지시, 2026-09-15) — **제조사 폴백(브랜드 프로필 → 판매자
   * 기본정보).** 지금까지 롯데ON payload만 `product.manufacturer.value` 하나를
   * 보고 있어서, 쿠팡·스마트스토어가 브랜드 프로필로 채워 주는 제조사가
   * 롯데ON에서는 통째로 빠졌다(mfcrNm 미전송).
   *
   * 값을 여기서 조회하지 않는다 — Naver의 `resolvedManufacturer`와 같은 규칙으로
   * 호출부(api/lotteon/_lib/build-context.ts)가 이미 읽어 둔 브랜드/판매자
   * 프로필을 넘겨받고, 우선순위 판정은 공통 `resolveManufacturer()` 하나가 한다.
   */
  brandProfileManufacturer?: string | null;
  /* 🔴 PIVOT NEXT-04c-2 — sellerProfileManufacturer 가 사라졌다. 계약에서
     빼야 호출부가 다시 넣을 수 없다(C 에서 배운 것 — 「안 보낸다」로는 부족하고
     「받지 않는다」여야 한다). */
  /** PriceEditor가 쓰는 것과 같은 환율/반올림 — resolveListingPrice에 그대로 넘긴다. */
  liveRates?: Record<string, number>;
  roundingUnit?: number;
}

/** 롯데ON은 "이미지 확장자 jpg/jpeg/png"만 받는다(문서 원문). 판별 불가한 URL은
 * 거르지 않고 그대로 보낸다 — 우리가 URL만 보고 확장자를 단정하면 정상 이미지를
 * 잘못 버릴 수 있다. 대신 validate가 경고한다. */
const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png)(\?.*)?$/i;

export function isLotteOnSupportedImageUrl(url: string): boolean {
  return IMAGE_EXTENSION_PATTERN.test(url);
}

/** 갤러리에 쓰기로 선택된 이미지들(대표 우선). getSelectedImageUrl로 원본/처리본
 * 선택 규칙은 공통 함수 하나만 쓴다. */
export function resolveLotteOnImageUrls(product: LotteOnProductInput): { representative: string | null; gallery: string[] } {
  const gallery = product.images.filter((image) => image.useInProductGallery);
  const representativeEntry = gallery.find((image) => image.isRepresentative) ?? gallery[0] ?? null;
  const representative = representativeEntry ? getSelectedImageUrl(representativeEntry) : null;
  // 단품당 최대 10개(문서 원문). 대표를 맨 앞에 두고 나머지를 순서대로.
  const rest = gallery.filter((image) => image !== representativeEntry).map((image) => getSelectedImageUrl(image));
  return { representative, gallery: [...(representative ? [representative] : []), ...rest].slice(0, 10) };
}

function toItemImages(urls: string[]): LotteOnItemImage[] {
  return urls.map((url, index) => ({
    epsrTypCd: "IMG" as const,
    // 문서 원문 EPSR_TYP_DTL_CD: IMG_SQRE(정사각형) / IMG_LNTH(세로형).
    // 이미지 실제 비율을 서버에서 알 수 없으므로 상품 이미지의 일반형인
    // 정사각형으로 보낸다(이 값은 노출 형태이지 원본을 자르지 않는다).
    epsrTypDtlCd: "IMG_SQRE" as const,
    origImgFileNm: url,
    rprtImgYn: index === 0 ? ("Y" as const) : ("N" as const),
  }));
}

/** 옵션 그룹이 실제로 등록 가능한 형태인지(이름과 값이 둘 다 있는지). */
export function hasLotteOnSellableOptions(product: LotteOnProductInput): boolean {
  return product.optionGroups.some((group) => group.name.trim() && group.values.some((value) => value.trim()));
}

/**
 * 단품 목록(itmLst)을 만든다.
 *
 * 옵션이 없으면 "옵션 없는 단품 1개"(sitmYn='N')가 되고, 있으면 variants를
 * 그대로 단품으로 편다. **옵션 조합을 우리가 생성하지 않는다** — 크롤러가
 * 실제로 확인한 variants만 쓴다(조합을 곱해서 만들면 원본에 없던 SKU가 생긴다).
 */
function buildItems(
  product: LotteOnProductInput,
  /**
   * 🔴 P0-D.3(CEO 지시, 2026-09-20) — **null 일 수 있다.** 가격이 확정되지 않은
   * 상태를 0 으로 바꾸지 않는다. 0 은 「0원에 판다」는 값이고, 「모른다」와 다르다.
   */
  basePriceKrw: number | null,
  liveRates: Record<string, number> | undefined,
): { items: LotteOnItem[]; optionSorts: LotteOnOptionSort[]; usesOptions: boolean } {
  const { gallery } = resolveLotteOnImageUrls(product);
  const images = toItemImages(gallery);
  const defaultStock = product.stockQuantity.value ?? 0;

  const usesOptions = hasLotteOnSellableOptions(product) && product.variants.length > 0;
  if (!usesOptions) {
    return {
      items: [
        {
          sortSeq: 1,
          rprtSitmYn: "Y",
          itmImgLst: images,
          slPrc: basePriceKrw,
          stkQty: defaultStock,
          ...(product.sku.value.trim() ? { eitmNo: product.sku.value.trim() } : {}),
        },
      ],
      optionSorts: [],
      usesOptions: false,
    };
  }

  const items: LotteOnItem[] = product.variants.map((variant, index) => {
    // 롯데ON slPrc는 **절대 판매가**다. computeVariantFinalPriceKrw가 원본
    // 통화에서 차액을 구해 환산한 뒤 기본 최종가에 더한 결과를 그대로 쓴다
    // (Naver는 같은 결과에서 차액만 떼어 쓴다 — 채널 스키마 차이일 뿐
    // 계산 자체는 같은 함수 하나다).
    // 🔴 기본가를 모르면 옵션가도 «만들지 않는다». 차액을 더할 기준이 없기
    //    때문이다 — 0 을 기준으로 더하면 옵션 차액 자체가 판매가가 된다.
    const finalKrw =
      basePriceKrw == null
        ? null
        : variant.price
          ? computeVariantFinalPriceKrw(
              { amount: product.price.value.amount, currency: product.price.value.currency, finalKrw: basePriceKrw },
              { amount: variant.price.amount, currency: variant.price.currency, mode: variant.priceMode },
              liveRates,
            ).finalKrw
          : basePriceKrw;

    const itmOptLst: LotteOnItemOption[] = Object.entries(variant.optionValues)
      .filter(([name, value]) => name.trim() && String(value).trim())
      .map(([name, value]) => ({ optNm: name.trim(), optVal: String(value).trim() }));

    return {
      sortSeq: index + 1,
      rprtSitmYn: index === 0 ? "Y" : "N",
      itmOptLst,
      itmImgLst: images,
      slPrc: finalKrw,
      stkQty: variant.stockQuantity ?? defaultStock,
      ...(variant.sku?.trim() ? { eitmNo: variant.sku.trim() } : {}),
    };
  });

  // optSrtLst — 단품에 쓰인 옵션명/옵션값의 노출 순서. 단품에 실제로 등장한
  // 값만 담는다(optionGroups에만 있고 variants에 없는 값은 팔 수 없으므로).
  const orderedGroups: { name: string; values: string[] }[] = [];
  for (const item of items) {
    for (const option of item.itmOptLst ?? []) {
      let group = orderedGroups.find((g) => g.name === option.optNm);
      if (!group) {
        group = { name: option.optNm, values: [] };
        orderedGroups.push(group);
      }
      if (!group.values.includes(option.optVal)) group.values.push(option.optVal);
    }
  }
  const optionSorts: LotteOnOptionSort[] = orderedGroups.map((group, groupIndex) => ({
    optSeq: groupIndex + 1,
    optNm: group.name,
    optValSrtLst: group.values.map((value, valueIndex) => ({ optValSeq: valueIndex + 1, optVal: value })),
  }));

  return { items, optionSorts, usesOptions: true };
}

/** 검색키워드는 5개 이하만 등록 가능(문서 원문). */
function resolveSearchKeywords(product: LotteOnProductInput): string[] {
  return product.keywords.value
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 5);
}

/** 등록 상품명 — AI 한국어 제목이 있으면 그것, 없으면 원문 제목. 롯데ON 상한 150자. */
export function resolveLotteOnProductName(product: LotteOnProductInput): string {
  const korean = product.titleKo.value.trim();
  const fallback = product.title.value.trim();
  return (korean || fallback).slice(0, 150);
}

export function buildLotteOnPayload(input: LotteOnPayloadInput): LotteOnProductRegistrationPayload {
  const { product, channel } = input;

  // 가격 단일 출처 — 새 경로를 만들지 않는다. UNRESOLVED면 0이 나오고
  // validate-payload.ts가 BLOCKED로 잡는다(0원 등록을 막는 것은 검증의 몫).
  const price = resolveListingPrice(
    {
      priceOverrideKrw: product.priceOverrideKrw?.value,
      originalAmount: product.price.value.amount,
      originalCurrency: product.price.value.currency,
      priceBreakdown: product.priceBreakdown,
      priceValidity: product.priceValidity,
    },
    input.liveRates,
    input.roundingUnit,
  );
  // 🔴 P0-D.3(CEO 지시, 2026-09-20) — 여기 있던 `price.priceKrw ?? 0` 을 지운다.
  //    UNRESOLVED 를 0 으로 바꾸면 preview 에 「등록가 ₩0」이 뜬다 — 그건 가격을
  //    모른다는 사실이 아니라 «0원에 판다»는 «다른 사실»이다. 실제 등록은
  //    validate 가 먼저 돌아 막고 있지만(register/route.ts:149), 막는 것과
  //    지어내지 않는 것은 별개다.
  const basePriceKrw = price.priceKrw;

  const { items, optionSorts, usesOptions } = buildItems(product, basePriceKrw, input.liveRates);
  const keywords = resolveSearchKeywords(product);
  /* REWORK-10 A — 전 채널 공통 resolver. 예전 이 줄은
     `product.manufacturer.value.trim()` 하나였다(브랜드/판매자 폴백 없음).
     REWORK-13A — 상품이 들고 있는 값을 ①(원본 명시) · ②(상품정보 확인) ·
     ⑤(직접 입력)으로 나누는 일도 공통 함수가 한다. */
  /* 🔴 PIVOT NEXT-04c-2 — 판매자 기본정보 단계가 사라졌다. 판매 사업자를
     제조사로 쓰라고 말하는 채널이 없다.

     🔴 그리고 brand 대체도 «넣지 않는다». 쿠팡 공식 API 에는 「정확한 제조사를
     기입할 수 없으면 brand 와 동일하게」라는 문구가 있지만 그건 «쿠팡의 정책»
     이다. 롯데ON 의 mfcrNm 규칙은 아직 확인되지 않았다(문서 0 · 실측 0) —
     남의 채널 정책을 복사해 오면 그게 곧 추측이다. */
  const manufacturer = resolveManufacturer({
    ...manufacturerInputFromProduct(product),
    brandProfileManufacturer: input.brandProfileManufacturer,
    brandName: product.brand.value,
  }).value;
  const modelNo = product.modelName.value.trim();
  const importerName = (channel.importerName ?? product.importer.value).trim();

  const registration: LotteOnProductRegistration = {
    trGrpCd: channel.trGrpCd ?? "",
    trNo: channel.trNo ?? "",
    ...(channel.lrtrNo ? { lrtrNo: channel.lrtrNo } : {}),

    scatNo: channel.standardCategoryNo ?? "",
    dcatLst: channel.displayCategories,

    ...(channel.externalProductNo ? { epdNo: channel.externalProductNo } : {}),

    slTypCd: "GNRL",
    pdTypCd: "GNRL_GNRL",

    spdNm: resolveLotteOnProductName(product),
    ...(channel.brandNo ? { brdNo: channel.brandNo } : {}),
    ...(manufacturer ? { mfcrNm: manufacturer } : {}),
    oplcCd: channel.originCode ?? "",
    ...(modelNo ? { mdlNo: modelNo } : {}),
    tdfDvsCd: channel.taxTypeCode,

    slStrtDttm: channel.saleStartDttm,
    slEndDttm: channel.saleEndDttm,

    pdItmsInfo: {
      pdItmsCd: channel.noticeItemCode ?? "",
      pdItmsArtlLst: channel.noticeArticles,
    },
    ...(channel.importProxyCode ? { impPrxCd: channel.importProxyCode } : {}),
    ...(channel.safetyCertifications.length > 0 ? { sftyAthnLst: channel.safetyCertifications } : {}),
    ...(channel.categoryAttributes.length > 0 ? { scatAttrLst: channel.categoryAttributes } : {}),

    // 구매수량 제한을 우리가 정책으로 갖고 있지 않다 — 제한 없음(N)으로 보낸다.
    // 값을 "제한 있음"으로 지어내면 셀러가 모르는 구매 제한이 생긴다.
    purPsbQtyInfo: {
      itmByMinPurYn: "N",
      itmByMaxPurPsbQtyYn: "N",
      maxPurLmtTypCd: "PERIOD",
    },
    ageLmtCd: "0",
    prstPckPsbYn: "N",
    prstMsgPsbYn: "N",

    ...(importerName ? { impCoNm: importerName } : {}),
    ...(importerName && channel.importDivisionCode ? { impDvsCd: channel.importDivisionCode } : {}),

    pdStatCd: "NEW",
    dpYn: "Y",
    ...(keywords.length > 0 ? { scKwdLst: keywords } : {}),
    epnLst: [{ pdEpnTypCd: "DSCRP", cnts: input.detailHtml }],

    cnclPsbYn: "Y",
    dmstOvsDvDvsCd: "DMST",
    // 업체배송 · 일반상품 — 이 저장소가 실제로 하는 형태다(센터배송/e쿠폰이 아니다).
    dvProcTypCd: "LO_ENTP",
    dvPdTypCd: "GNRL",
    sndBgtNday: channel.shipBudgetDays,
    sndBgtDdInfo: {
      nldySndCloseTm: channel.weekdayCloseTime,
      satSndPsbYn: channel.saturdayShippingAvailable ? "Y" : "N",
      ...(channel.saturdayShippingAvailable && channel.saturdayCloseTime
        ? { satSndCloseTm: channel.saturdayCloseTime }
        : {}),
    },
    dvRgsprGrpCd: channel.deliveryRegionGroupCode ?? "",
    dvMnsCd: "DPCL",
    owhpNo: channel.outboundPlaceNo ?? "",
    ...(channel.courierCode ? { hdcCd: channel.courierCode } : {}),
    dvCstPolNo: channel.deliveryCostPolicyNo ?? "",

    rtngPsbYn: "Y",
    xchgPsbYn: "Y",
    ...(channel.returnCourierCode ? { rtngHdcCd: channel.returnCourierCode } : {}),
    rtngRtrvPsbYn: "Y",
    rtrpNo: channel.returnPlaceNo ?? "",

    stkMgtYn: "Y",
    sitmYn: usesOptions ? "Y" : "N",
    ...(optionSorts.length > 0 ? { optSrtLst: optionSorts } : {}),
    itmLst: items,
    adtnPdYn: "N",
  };

  return { spdLst: [registration] };
}

/** 판매 기간 문자열 [YYYYMMDDHH24MISS]. 롯데ON은 시작/종료 둘 다 필수다.
 * 지금(KST) 기준 시작 + years년 뒤 종료 — 이 저장소의 기존 두 채널과 같은
 * "무기한에 가까운 종료일" 관행을 따르되, 값을 명시적으로 만든다. */
export function buildLotteOnSalePeriod(now: Date, years = 5): { saleStartDttm: string; saleEndDttm: string } {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  const start = `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}${pad(kst.getUTCHours())}${pad(kst.getUTCMinutes())}${pad(kst.getUTCSeconds())}`;
  const end = `${kst.getUTCFullYear() + years}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}235959`;
  return { saleStartDttm: start, saleEndDttm: end };
}
