import { resolveListingPrice } from "@commerce/pricing";
import { blocksRegistration, resolveSourceStock } from "@commerce/shared";
import type { LotteOnPayloadInput } from "./build-payload";
import { hasLotteOnSellableOptions, isLotteOnSupportedImageUrl, resolveLotteOnImageUrls } from "./build-payload";
import { isKnownLotteOnTaxType } from "./tax-type";
/* 🔴 LOTTEON-FINAL-07 — 필수 목록을 여기서 «다시 적지» 않는다. 품목별 항목표는
   공식 문서에서 옮겨 온 notice-schema.ts 한 곳에 있고, 여기서는 읽기만 한다. */
import { noticeSchemaFor } from "./notice-schema";

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
  /* LOTTEON-FINAL-05 #2 — 「대상 아님」이라고 신고하면서 인증정보를 함께 보낸다.
     둘 다 보내면 어느 쪽으로 신고한 것인지 알 수 없다(네이버의
     KC_EXEMPTION_REASON_NOT_ALLOWED 와 같은 종류의 «반쪽 신고» 다). */
  | "SAFETY_DECLARATION_CONFLICT"
  | "IMPORT_PROXY_REQUIRED"
  | "SELLER_PLACE_REQUIRED"
  | "TEMP_IMAGE_URL"
  /* Commerce-6 C-2E — 원본 상품이 품절이거나 재고 값이 비정상이다. 🔴 셀러가
     이 탭에서 채울 수 있는 값이 아니라 «원본의 사실» 이라 BLOCKED 다. */
  | "SOURCE_STOCK_UNAVAILABLE"
  /* 🔴 과세유형이 우리가 아는 넷(01·02·03·04) 중에 «없다». 셀러가 고칠 수 없는
     값이라 BLOCKED 다 — 205 가 모르는 값을 줬거나 저장된 값이 손상된 경우다. */
  | "TAX_TYPE_UNKNOWN";

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

  /* 4b) 🔴 과세유형 — 검사가 «0줄» 이었다(CPO 2차 감사).
     그래서 근거 없는 "01"(과세)이 조용히 payload 로 나갔다. tdfDvsCd 는 조건부가
     아니라 «무조건» 실리는 키라 비워 둘 수도 없다 — 값이 필요하고, 그 값이
     우리가 지어낸 것이면 안 된다.

     🔴 「모른다」를 01 로 바꾸지 않는다(CPO 확정). 비었으면 여기서 막고,
     셀러가 ⑪에서 고르거나 카테고리를 추천에서 고르면 205 가 채운다. */
  if (isKnownLotteOnTaxType(channel.taxTypeCode)) ready("tdfDvsCd", "과세 유형");
  else if (!channel.taxTypeCode?.trim())
    missing(
      "tdfDvsCd",
      "과세 유형",
      "과세 유형이 정해지지 않았습니다. 표준카테고리를 추천에서 고르면 자동으로 채워지고, 직접 고를 수도 있습니다.",
    );
  else
    blocked(
      "tdfDvsCd",
      "과세 유형",
      "과세 유형이 롯데ON이 정한 값(과세·면세·영세·해당없음) 중 하나가 아닙니다.",
      "TAX_TYPE_UNKNOWN",
    );

  // 5) 상품정보제공고시 — 품목코드 + 항목 목록.
  if (channel.noticeItemCode) ready("pdItmsCd", "상품품목코드(고시)");
  else blocked("pdItmsCd", "상품품목코드(고시)", "상품품목코드(PD_ITMS_CD)가 지정되지 않았습니다.", "NOTICE_REQUIRED");

  if (!(channel.noticeArticles.length > 0 && channel.noticeArticles.every((a) => a.pdArtlCd && a.pdArtlCnts.trim()))) {
    blocked(
      "pdItmsArtlLst",
      "고시 항목",
      "상품정보제공고시 항목이 비어 있거나 값이 없는 항목이 있습니다. 항목코드(pdArtlCd)는 품목마다 코드체계가 달라 자동 생성하지 않습니다.",
      "NOTICE_REQUIRED",
    );
  } else {
    /* ══ 🔴 LOTTEON-FINAL-07(실측, 2026-09-29) — **전 항목이 필수다** ══════════
       이 자리는 「값이 있는 항목들이 온전한가」만 봤다. 그래서 13항목 중 10개만
       실어도 READY 였고, 화면은 「등록 가능」인데 롯데ON 이 거절했다 —

           returnCode 0000 / 9999 상품품목항목코드 필수값이 누락입니다
           (판매자상품번호 spdNo 없음 = 실제로 등록되지 않았다)

       🔴 이것은 추정이 아니라 **첫 실제 CREATE 응답** 이다. 그전까지 이 저장소는
       「검증기는 13개를 요구하지 않는다」고 적어 두었고(그 테스트까지 있었다),
       그 판단이 Production 에서 틀린 것으로 드러났다.

       🔴 항목을 «만들어» 채우지 않는다. 여기서는 막기만 하고, 무엇이 비었는지
       이름으로 말한다 — 셀러는 고시 섹션(0220·1830)과 판매자 설정(0090 A/S)에서
       채운다. 두 입구 모두 이미 화면에 있다.

       🔴 품목 표를 «모르면» 예전 그대로다. 모르는 품목에 우리가 필수 목록을
       지어내지 않는다. */
    const schema = noticeSchemaFor(channel.noticeItemCode);
    const present = new Set(channel.noticeArticles.map((a) => a.pdArtlCd.trim()));
    const missingRequired = (schema ?? []).filter((spec) => spec.required && !present.has(spec.code));
    if (missingRequired.length > 0) {
      blocked(
        "pdItmsArtlLst",
        "고시 항목",
        `롯데ON은 이 품목의 고시 항목을 «전부» 요구합니다(실측: 9999 상품품목항목코드 필수값 누락). 아직 비어 있는 항목 ${missingRequired.length}개 — ${missingRequired
          .map((spec) => spec.label)
          .join(" · ")}.`,
        "NOTICE_REQUIRED",
      );
    } else {
      ready("pdItmsArtlLst", "고시 항목");
    }
  }

  /* ══ 6) 안전인증(KC) — LOTTEON-FINAL-05 #2(CEO 지시, 2026-09-29) ═══════════
     전에는 축이 «하나» 였다: 인증정보가 있는가 없는가. 그래서 품목 23 에서
     실제로 인증 대상이 아닌 상품에도 출구가 없었고, 등록하려면 아무 값이나
     넣는 수밖에 없었다 — 스마트스토어에서 「12313ㄹㅇ」을 낳은 바로 그 구조다.

       정직한 판매자는 막히고, 아무 값이나 넣은 판매자는 통과한다.
       출구가 없으면 시스템은 거짓말을 보상한다.

     그래서 판매자가 «신고하는» 축을 하나 더 읽는다. 셋을 구별한다:

       미선택(null)  아직 고른 적 없다  → 품목 23 이면 예전과 «똑같이» 막는다
       TARGET        대상이다           → 실제 인증정보가 있어야 한다
       EXCLUDED      대상이 아니다      → 인증정보를 요구하지 않는다

     🔴 여기서 «판정하지» 않는다. 어떤 상품이 인증 대상인지는 법적 판단이고
     따져는 그것을 모른다 — 판매자가 고른 것을 그대로 받아 적을 뿐이다.
     🔴 미선택을 EXCLUDED 로 읽지 않는다. 확인하지 않은 것을 확인했다고 말하는
     것이 되고, 그 한 줄이 이 섹션 전체의 안전장치다. */
  const isChildrenNotice = channel.noticeItemCode === LOTTEON_NOTICE_ITEM_CODE_CHILDREN;
  const hasCertifications = channel.safetyCertifications.length > 0;

  if (channel.safetyTarget === "EXCLUDED" && hasCertifications) {
    /* 🔴 두 주장이 겹친다. 어느 쪽으로 신고한 것인지 알 수 없는 payload 를
       롯데ON 으로 보내지 않는다 — 셀러가 하나를 지워야 한다. */
    blocked(
      "sftyAthnLst",
      "안전인증",
      "「인증 대상 아님」으로 신고하면서 안전인증 정보가 함께 들어 있습니다. 대상이면 대상으로 고치고, 대상이 아니면 인증 정보를 비워 주세요.",
      "SAFETY_DECLARATION_CONFLICT",
    );
  } else if (channel.safetyTarget === "EXCLUDED") {
    /* 🔴 판매자의 «신고» 다. 따져가 면제를 판정한 것이 아니므로 라벨이 그렇게
       말한다 — 화면이 「따져가 확인했다」로 읽히면 안 된다. */
    ready("sftyAthnLst", "안전인증(인증 대상 아님 — 판매자 신고)");
  } else if (hasCertifications) {
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
  } else if (channel.safetyTarget === "TARGET") {
    /* 🔴 품목코드와 무관하게 막는다. 판매자가 «대상이다» 라고 말한 상품을
       인증정보 없이 내보내지 않는다 — 신고와 payload 가 어긋난 상태다. */
    blocked(
      "sftyAthnLst",
      "안전인증",
      "「인증 대상」으로 신고했습니다 — 실제로 취득한 인증 유형과 인증번호를 입력해야 등록할 수 있습니다. 인증번호는 어떤 경우에도 만들어 넣지 않습니다.",
      "SAFETY_CERTIFICATION_REQUIRED",
    );
  } else if (isChildrenNotice) {
    blocked(
      "sftyAthnLst",
      "안전인증",
      "품목코드 23(어린이제품)은 안전인증 대상 여부를 먼저 신고해야 합니다. 인증 대상이면 실제 인증 유형과 인증번호를, 대상이 아니면 「인증 대상 아님」을 선택해 주세요.",
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

  /* ══ 12) 재고 — Commerce-6 C-2D(CPO 지시, 2026-09-26) ══

     🔴 이 검사가 «없었다». 롯데ON 은 단품마다 재고를 실어 보내는데 그 값이
     0 이어도 막는 곳이 한 곳도 없었다 — 재고 0 인 상품이 「등록 가능」으로
     표시됐다. 세 채널을 대조해 보니 셋 다 막지 못하고 있었다(스마트스토어는
     검증기가 «있었지만» 빌더가 0 을 1 로 바꿔 넘겨서 무효였다 — C-2D 에서
     그 `|| 1` 도 함께 걷어냈다).

     🔴 옵션 상품을 잘못 막지 않는다. 위 itmLst 와 같은 해석을 쓴다 — 단품은
     상품 재고를, 옵션 상품은 조합 중 하나라도 재고가 있으면 판다고 본다. */
  /* 🔴 C-2E — C-2D 에서 쓴 `product.stockQuantity.value > 0` 은 «무효» 였다.
     그 값은 사실상 언제나 999(파이프라인 DEFAULT)라서 옵션이 전부 품절이어도
     통과했다. 해석은 shared/source-stock 한 곳에서만 한다.

     BLOCKED 인 이유: 이 탭에서 «채울 수 있는» 값이 아니다. 원본 상품의 사실이라
     셀러가 여기서 숫자를 고쳐 해결할 일이 아니다(MISSING 의 뜻과 다르다). */
  const stockFact = resolveSourceStock(product);
  if (blocksRegistration(stockFact)) {
    blocked("itmStkQty", "재고", stockFact.note, "SOURCE_STOCK_UNAVAILABLE");
  } else if (stockFact.state === "UNKNOWN") {
    /* 🔴 모르는 것을 품절이라고 말하지 않는다(CEO 정책). 막지 않되 라벨이
       사실을 말한다 — 999 를 「재고 있음」으로 보여주지 않는다. */
    ready("itmStkQty", "재고(원본 미확인)");
  } else {
    ready("itmStkQty", "재고");
  }

  const readyCount = fields.filter((f) => f.status === "READY").length;
  const missingCount = fields.filter((f) => f.status === "MISSING").length;
  const blockedCount = fields.filter((f) => f.status === "BLOCKED").length;

  return { ok: missingCount === 0 && blockedCount === 0, fields, readyCount, missingCount, blockedCount };
}
