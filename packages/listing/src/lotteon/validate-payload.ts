import { resolveListingPrice } from "@commerce/pricing";
import type { LotteOnPayloadInput } from "./build-payload";
import { hasLotteOnSellableOptions, isLotteOnSupportedImageUrl, resolveLotteOnImageUrls } from "./build-payload";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 3 — 실제 POST 없이 87 payload가 등록 가능한
 * 수준인지 검증한다. Naver validate-payload.ts와 같은 어휘를 쓴다:
 *
 *   READY   — 채워졌다
 *   MISSING — 값을 확인/입력하면 채울 수 있는 일반 필수값 누락
 *   BLOCKED — CartPilot이 **만들어낼 수 없는** 값이거나(외부 코드/인증 정보),
 *             지금 상태로 보내면 잘못된 등록이 되는 값. 등록 시도 자체를 막는다.
 *
 * 새 검증 규칙을 Preview와 Register가 각자 갖지 않는다 — 두 라우트가 이 함수
 * 하나를 부른다(N-4.12 STEP1 결론: "Preview=Validation=Register가 같은 함수를
 * 쓰는지가 유일한 검증 기준").
 */
export type LotteOnBlockCode =
  | "PRICE_UNRESOLVED"
  | "IDENTITY_REQUIRED"
  | "CATEGORY_REQUIRED"
  | "NOTICE_REQUIRED"
  | "SAFETY_CERTIFICATION_REQUIRED"
  | "IMPORT_PROXY_REQUIRED"
  | "SELLER_PLACE_REQUIRED"
  | "TEMP_IMAGE_URL";

export interface LotteOnFieldCheck {
  field: string;
  label: string;
  status: "READY" | "MISSING" | "BLOCKED";
  reason?: string;
  code?: LotteOnBlockCode;
}

export interface LotteOnValidationResult {
  /** BLOCKED가 하나도 없고 MISSING도 없을 때만 true — 등록 버튼의 게이트다. */
  ok: boolean;
  fields: LotteOnFieldCheck[];
  readyCount: number;
  missingCount: number;
  blockedCount: number;
}

/**
 * 문서 원문(87 sftyAthnTypCd 표)의 "수입대행코드 필수" 비고가 붙은 유형들.
 * 이 목록은 문서에서 그대로 옮긴 것이고 추론이 아니다.
 */
const SAFETY_TYPES_REQUIRING_IMPORT_PROXY = new Set([
  "ELC_AHTN",
  "ELC_CFM",
  "ELC_SUPS",
  "LIFE_ATHN",
  "LIFE_CFM",
  "LIFE_SUPS",
  "LIFE_STD",
  "KC_CHL_PKG",
  "ETC",
  "CMCN_TNTT",
  "CMCN_REG",
  "CMCN_ATHN",
  "MTR_APRV",
  "DRT_IPT",
  "DTL_REFC",
]);

/** 품목코드 23 = 어린이제품(유아동). 문서 원문: "품목코드가 23번 유아동인 경우
 * 표준카테고리에 따라 **안전인증목록이 필수값**이다." 이 저장소의 주력
 * 카테고리라 회피할 수 없다. */
export const LOTTEON_NOTICE_ITEM_CODE_CHILDREN = "23";

/** 문서 원문 경고 — `doc-pub.lotteon.com/ec/public` 는 임시/비영구 저장 경로다.
 * 상세페이지 HTML에 이 경로가 남아 있으면 며칠 뒤 이미지가 사라진다. */
const TEMPORARY_IMAGE_HOST_PATTERN = /doc-pub\.lotteon\.com\/ec\/public/i;

/** 발송마감시간은 [HH24MI]이고 분은 00/30만 허용된다(문서 원문). */
function isValidCloseTime(value: string): boolean {
  if (!/^\d{4}$/.test(value)) return false;
  const hour = Number(value.slice(0, 2));
  const minute = value.slice(2);
  return hour >= 0 && hour <= 23 && (minute === "00" || minute === "30");
}

export function validateLotteOnPayload(input: LotteOnPayloadInput): LotteOnValidationResult {
  const { product, channel } = input;
  const fields: LotteOnFieldCheck[] = [];

  const ready = (field: string, label: string) => fields.push({ field, label, status: "READY" });
  const missing = (field: string, label: string, reason: string) =>
    fields.push({ field, label, status: "MISSING", reason });
  const blocked = (field: string, label: string, reason: string, code?: LotteOnBlockCode) =>
    fields.push({ field, label, status: "BLOCKED", reason, code });

  // 1) 거래처 — 207 Identity가 주는 값. 우리가 만들 수 없다.
  if (channel.trGrpCd && channel.trNo) ready("trNo", "거래처 정보");
  else
    blocked(
      "trNo",
      "거래처 정보",
      "롯데ON Identity(207) 조회로 거래처그룹코드/거래처번호를 확인하지 못했습니다. 인증키와 서버 IP 등록 상태를 먼저 확인하세요.",
      "IDENTITY_REQUIRED",
    );

  // 2) 카테고리 — 롯데ON만 표준 + 전시 2중 구조다.
  if (channel.standardCategoryNo) ready("scatNo", "표준카테고리");
  else
    blocked(
      "scatNo",
      "표준카테고리",
      "롯데ON 표준카테고리번호가 선택되지 않았습니다. 네이버/쿠팡 카테고리는 그대로 쓸 수 없습니다(코드체계가 다릅니다).",
      "CATEGORY_REQUIRED",
    );

  if (channel.displayCategories.length > 0 && channel.displayCategories.every((c) => c.mallCd && c.lfDcatNo))
    ready("dcatLst", "전시카테고리");
  else
    blocked(
      "dcatLst",
      "전시카테고리",
      "전시카테고리를 1개 이상 선택해야 합니다. 표준카테고리에 매핑된 전시카테고리 중에서 고릅니다(롯데ON은 표준/전시 2중 카테고리입니다).",
      "CATEGORY_REQUIRED",
    );

  // 3) 상품명 / 가격.
  const productName = (product.titleKo.value.trim() || product.title.value.trim()).trim();
  if (productName) ready("spdNm", "판매자상품명");
  else missing("spdNm", "판매자상품명", "상품명이 비어 있습니다.");

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
  if (price.source === "UNRESOLVED" || !price.priceKrw || price.priceKrw <= 0) {
    blocked("slPrc", "판매가", "판매가격을 계산하지 못했습니다(원본 가격 미확인 또는 환율 미확정).", "PRICE_UNRESOLVED");
  } else {
    ready("slPrc", "판매가");
  }

  // 4) 원산지 코드 — 텍스트를 코드로 추론하지 않는다.
  if (channel.originCode) ready("oplcCd", "원산지코드");
  else
    missing(
      "oplcCd",
      "원산지코드",
      "롯데ON 원산지코드(공통코드 OPLC_CD)가 지정되지 않았습니다. 원산지 텍스트만으로는 코드를 정할 수 없습니다.",
    );

  // 5) 상품정보제공고시 — 품목코드 + 항목 목록.
  if (channel.noticeItemCode) ready("pdItmsCd", "상품품목코드(고시)");
  else blocked("pdItmsCd", "상품품목코드(고시)", "상품품목코드(PD_ITMS_CD)가 지정되지 않았습니다.", "NOTICE_REQUIRED");

  if (channel.noticeArticles.length > 0 && channel.noticeArticles.every((a) => a.pdArtlCd && a.pdArtlCnts.trim()))
    ready("pdItmsArtlLst", "고시 항목");
  else
    blocked(
      "pdItmsArtlLst",
      "고시 항목",
      "상품정보제공고시 항목이 비어 있거나 값이 없는 항목이 있습니다. 항목코드(pdArtlCd)는 품목마다 코드체계가 달라 자동 생성하지 않습니다.",
      "NOTICE_REQUIRED",
    );

  // 6) 안전인증(KC) — 유아동(23)이면 필수다.
  const isChildrenNotice = channel.noticeItemCode === LOTTEON_NOTICE_ITEM_CODE_CHILDREN;
  if (channel.safetyCertifications.length > 0) {
    const incomplete = channel.safetyCertifications.some((c) => !c.sftyAthnTypCd || !c.sftyAthnNo?.trim());
    if (incomplete) {
      blocked(
        "sftyAthnLst",
        "안전인증",
        "안전인증 항목에 유형코드 또는 인증번호가 비어 있습니다. 인증번호는 절대 임의로 만들 수 없습니다.",
        "SAFETY_CERTIFICATION_REQUIRED",
      );
    } else {
      ready("sftyAthnLst", "안전인증");
    }

    const needsImportProxy = channel.safetyCertifications.some((c) =>
      SAFETY_TYPES_REQUIRING_IMPORT_PROXY.has(c.sftyAthnTypCd),
    );
    if (needsImportProxy && !channel.importProxyCode) {
      blocked(
        "impPrxCd",
        "수입대행코드",
        "선택한 안전인증유형은 수입대행코드(IMP_PRX_CD)가 필수입니다(구매대행/병행수입/해당없음).",
        "IMPORT_PROXY_REQUIRED",
      );
    } else if (needsImportProxy) {
      ready("impPrxCd", "수입대행코드");
    }
  } else if (isChildrenNotice) {
    blocked(
      "sftyAthnLst",
      "안전인증",
      "품목코드 23(어린이제품)은 표준카테고리에 따라 안전인증목록이 필수입니다. 실제 KC 인증 정보를 입력해야 합니다.",
      "SAFETY_CERTIFICATION_REQUIRED",
    );
  }

  // 7) 이미지.
  const { representative, gallery } = resolveLotteOnImageUrls(product);
  if (!representative) {
    missing("itmImgLst", "대표 이미지", "갤러리에 사용할 대표 이미지가 지정되지 않았습니다.");
  } else {
    const unsupported = gallery.filter((url) => !isLotteOnSupportedImageUrl(url));
    if (unsupported.length > 0) {
      missing(
        "itmImgLst",
        "대표 이미지",
        `롯데ON은 jpg/jpeg/png만 등록할 수 있습니다. 확장자를 확인할 수 없는 이미지 ${unsupported.length}건이 있습니다.`,
      );
    } else {
      ready("itmImgLst", "대표 이미지");
    }
  }

  // 8) 상세페이지.
  const detail = input.detailHtml.trim();
  if (!detail) {
    missing("epnLst", "상품기술서", "상세페이지 내용이 비어 있습니다.");
  } else if (TEMPORARY_IMAGE_HOST_PATTERN.test(detail)) {
    blocked(
      "epnLst",
      "상품기술서",
      "상세페이지에 롯데ON 임시 이미지 경로(doc-pub.lotteon.com/ec/public)가 포함돼 있습니다. 일정 시점 후 이미지가 사라집니다.",
      "TEMP_IMAGE_URL",
    );
  } else {
    ready("epnLst", "상품기술서");
  }

  // 9) 판매자 인프라 번호 — 거래처 API로 선등록돼 있어야 하는 값들.
  const placeChecks: { field: string; label: string; value: string | null }[] = [
    { field: "owhpNo", label: "출고지번호", value: channel.outboundPlaceNo },
    { field: "rtrpNo", label: "회수지(반품지)번호", value: channel.returnPlaceNo },
    { field: "dvCstPolNo", label: "배송비정책번호", value: channel.deliveryCostPolicyNo },
    { field: "dvRgsprGrpCd", label: "배송가능지역코드", value: channel.deliveryRegionGroupCode },
  ];
  for (const check of placeChecks) {
    if (check.value) ready(check.field, check.label);
    else
      blocked(
        check.field,
        check.label,
        `${check.label}는 롯데ON 판매자센터(또는 거래처 API)에 먼저 등록돼 있어야 합니다. 임의 값을 보낼 수 없습니다.`,
        "SELLER_PLACE_REQUIRED",
      );
  }

  // 10) 판매기간 / 발송 정보.
  if (/^\d{14}$/.test(channel.saleStartDttm) && /^\d{14}$/.test(channel.saleEndDttm)) ready("slStrtDttm", "판매기간");
  else missing("slStrtDttm", "판매기간", "판매시작/종료일시가 YYYYMMDDHH24MISS 형식으로 채워지지 않았습니다.");

  if (isValidCloseTime(channel.weekdayCloseTime)) ready("nldySndCloseTm", "평일 발송마감시간");
  else
    missing(
      "nldySndCloseTm",
      "평일 발송마감시간",
      "평일 발송마감시간은 HHMM 형식이며 분은 00 또는 30만 등록할 수 있습니다.",
    );

  if (channel.saturdayShippingAvailable && !isValidCloseTime(channel.saturdayCloseTime ?? "")) {
    missing("satSndCloseTm", "토요일 발송마감시간", "토요일 발송가능으로 설정하면 토요일 발송마감시간이 필수입니다.");
  }

  // 11) 옵션/단품.
  const usesOptions = hasLotteOnSellableOptions(product) && product.variants.length > 0;
  if (usesOptions && product.variants.length > 500) {
    blocked("itmLst", "옵션(단품)", "롯데ON은 단품을 최대 500개까지만 등록할 수 있습니다.");
  } else if (hasLotteOnSellableOptions(product) && product.variants.length === 0) {
    missing(
      "itmLst",
      "옵션(단품)",
      "옵션 축은 있는데 실제 조합(variant) 정보가 없습니다. 조합을 임의로 생성하지 않습니다 — 옵션 정보를 확인해 주세요.",
    );
  } else {
    ready("itmLst", "옵션(단품)");
  }

  const readyCount = fields.filter((f) => f.status === "READY").length;
  const missingCount = fields.filter((f) => f.status === "MISSING").length;
  const blockedCount = fields.filter((f) => f.status === "BLOCKED").length;

  return { ok: missingCount === 0 && blockedCount === 0, fields, readyCount, missingCount, blockedCount };
}
