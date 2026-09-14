import type {
  CanonicalProduct,
  LotteOnChannelInfo,
  LotteOnSelectedCategoryFacts,
  PlatformId,
} from "@commerce/shared";
import type { CategorySelection } from "@commerce/category";
import {
  hasLotteOnSellableOptions,
  resolveLotteOnImageUrls,
  resolveLotteOnProductName,
} from "@commerce/listing";
import {
  parseLotteOnDisplayCategory,
  parseLotteOnStandardCategory,
  type LotteOnStandardCategory,
} from "./lotteon-category";

/**
 * LOTTEON COMMERCE SPRINT 3(CEO 확정, 2026-09-14) — 롯데ON 탭이 **무엇을 다시
 * 묻고 무엇을 묻지 않는가**를 정하는 단 하나의 파일.
 *
 * ── 이 파일이 존재하는 이유 ────────────────────────────────────────────────
 * CEO 지시의 핵심은 "롯데ON만 잘 등록되는 것"이 아니라 "네이버·쿠팡과 다른 세
 * 번째 시스템을 하나 더 만들지 않는 것"이다. 그 실패는 항상 같은 모양으로
 * 온다 — 채널 탭이 상품명·가격·옵션을 **다시 입력받기 시작하는 순간** 같은
 * 상품이 화면 안에 두 벌 생기고, 둘이 갈라진다.
 *
 * 그래서 경계를 컴포넌트 안이 아니라 여기 순수 함수로 못 박는다:
 *
 *   공통(재입력 금지)  상품명 · 대표이미지 · 상세페이지 · 가격 · 옵션 · 재고
 *                      → CanonicalProduct에서 **읽기만** 한다. 이 파일에는
 *                        그 값을 고치는 함수가 하나도 없다(setter가 없다).
 *   롯데ON 전용(입력)  표준+전시 카테고리 · 고시 · 안전인증 · 배송 선등록 번호
 *                      → 상품 데이터에서 파생할 수 없는 외부 코드들뿐이다.
 *
 * ── 왜 컴포넌트에서 분리했는가 ─────────────────────────────────────────────
 * 아래 함수들은 React를 모르고 fetch를 모른다. 그래서 "공통 정보를 재입력받지
 * 않는다"와 "유아동은 안전인증 없이 통과하지 못한다" 같은 규칙을 렌더링 없이
 * 테스트로 고정할 수 있다(__tests__/lotteon-channel-form.test.ts).
 *
 * ── 요약이 payload와 갈라지지 않게 하는 방법 ───────────────────────────────
 * 화면에 "이 값으로 등록됩니다"를 보여주려면 그 값을 어딘가에서 계산해야 하고,
 * 거기서 두 벌이 생긴다. 그래서 summarizeCommonProduct()는 **새로 계산하지
 * 않는다** — 실제 87 payload를 만드는 packages/listing/src/lotteon/build-payload.ts
 * 가 쓰는 바로 그 함수(resolveLotteOnProductName / resolveLotteOnImageUrls /
 * hasLotteOnSellableOptions)를 그대로 부르고, 가격은 화면이 이미 계산해 둔
 * resolveListingPrice() 결과를 인자로 받기만 한다.
 */

/** 고시 품목코드 23 = 어린이제품(유아동). 안전인증이 필수가 되는 분기점이다. */
export const LOTTEON_CHILD_PRODUCT_ITEM_CODE = "23";

/**
 * 롯데ON 카테고리는 **표준 + 전시 2중 구조**다.
 *
 * 🔴 공통 category를 덮어쓰지 않는다(CEO 명시). 이 타입에는 공통 카테고리를
 * 담는 필드가 아예 없다 — 공통 쪽 값은 아래 CommonCategorySource로 **읽기만**
 * 하고, 그 둘을 잇는 것이 "매핑"이다. 한 필드에 같이 담으면 롯데ON에서 고른
 * 번호가 스마트스토어/쿠팡 카테고리를 덮어쓰는 사고가 구조적으로 가능해진다.
 */
export interface LotteOnCategoryMapping {
  /** 표준카테고리번호(scatNo) — onpick 205. */
  standardCategoryNo: string;
  /** 전시카테고리번호(dcatLst) — onpick 206. 표준카테고리에 매핑된 것만 가능. */
  displayCategoryNos: string[];
  /**
   * 위 번호를 고를 때 카테고리가 **함께 알려준** 최소 사실(저장 타입과 같은
   * 모양이다 — @commerce/shared의 LotteOnSelectedCategoryFacts).
   *
   * 번호를 손으로 친 경우에는 없다. "없음"과 "빈 목록"은 다른 말이다 — 없음은
   * 우리가 이 번호의 요구조건을 들은 적이 없다는 뜻이고, 빈 목록은 요구하는
   * 것이 없다고 들었다는 뜻이다.
   */
  selected?: LotteOnSelectedCategoryFacts | null;
}

/** 고시(상품정보제공고시) — pdItmsCd + pdItmsArtlLst[]. */
export interface LotteOnNoticeForm {
  /** 상품품목코드(pdItmsCd). */
  itemCode: string;
  /** 한 줄에 하나씩 `항목코드:내용`. 코드체계는 품목마다 달라 생성하지 않는다. */
  articlesText: string;
}

/** 인증 — sftyAthnLst[] + impPrxCd. */
export interface LotteOnCertificationForm {
  /** 한 줄에 하나씩 `유형코드:인증번호[:기관명]`. */
  safetyText: string;
  /** 수입대행코드(impPrxCd). */
  importProxyCode: string;
}

/** 배송 — 출고지 · 반품지 · 배송비 정책 · 배송가능지역(전부 롯데ON 선등록 값). */
export interface LotteOnDeliveryForm {
  outboundPlaceNo: string;
  returnPlaceNo: string;
  deliveryCostPolicyNo: string;
  deliveryRegionGroupCode: string;
  courierCode: string;
  returnCourierCode: string;
  weekdayCloseTime: string;
}

/** 위 네 축에 들어가지 않는 나머지 롯데ON 코드들. */
export interface LotteOnProductCodeForm {
  /** 원산지코드(oplcCd) — 원산지 텍스트에서 추론하지 않는다. */
  originCode: string;
  /** 과세유형코드(tdfDvsCd). */
  taxTypeCode: string;
  /** 브랜드번호(brdNo) — 문자열 브랜드명은 이 필드에 들어가지 않는다. */
  brandNo: string;
  /** 업체상품번호(epdNo) — 우리 쪽 식별자. */
  externalProductNo: string;
}

/**
 * 롯데ON 탭이 들고 있는 입력 전부. **상품명/가격/옵션/재고/이미지가 없다** —
 * 그것이 이 타입의 존재 이유다. 필드를 더하기 전에 "이 값을 CanonicalProduct
 * 에서 읽을 수 있는가"를 먼저 물어라. 읽을 수 있으면 여기 넣지 마라.
 */
export interface LotteOnChannelForm {
  category: LotteOnCategoryMapping;
  notice: LotteOnNoticeForm;
  certification: LotteOnCertificationForm;
  delivery: LotteOnDeliveryForm;
  codes: LotteOnProductCodeForm;
}

export const EMPTY_LOTTEON_CHANNEL_FORM: LotteOnChannelForm = {
  category: { standardCategoryNo: "", displayCategoryNos: [] },
  notice: { itemCode: "", articlesText: "" },
  certification: { safetyText: "", importProxyCode: "" },
  delivery: {
    outboundPlaceNo: "",
    returnPlaceNo: "",
    deliveryCostPolicyNo: "",
    deliveryRegionGroupCode: "",
    courierCode: "",
    returnCourierCode: "",
    // 문서 기본 관행(평일 14:00 마감). 분은 00/30만 허용된다.
    weekdayCloseTime: "1400",
  },
  codes: { originCode: "", taxTypeCode: "01", brandNo: "", externalProductNo: "" },
};

/* ── 저장 ↔ 폼 ──────────────────────────────────────────────────────────────
 *
 * 3층 구조 재정렬(CEO 지시, 2026-09-14). 예전에는 위 폼이 컴포넌트 로컬
 * useState에만 있어서 **탭을 벗어나면 사라졌다**. 이제 같은 값이 상품 수준
 * (CanonicalProduct.lotteOnChannelInfo)에 저장되고, 탭에 다시 들어오면 여기서
 * 폼으로 되돌아온다.
 *
 * 두 타입의 필드 이름을 일부러 1:1로 맞췄다 — 이름이 갈라지면 "저장은 됐는데
 * 화면에 안 돌아오는" 버그가 조용히 생긴다. 그래도 매핑을 명시적으로 적는
 * 이유는 저장 타입이 @commerce/shared에 있어서(다른 패키지가 읽는다) 폼 쪽
 * 사정으로 모양이 바뀌면 안 되기 때문이다.
 */

/** 폼 → 저장. 화면이 들고 있는 문자열을 그대로 옮긴다(해석하지 않는다). */
export function toLotteOnChannelInfo(form: LotteOnChannelForm): LotteOnChannelInfo {
  return {
    category: {
      standardCategoryNo: form.category.standardCategoryNo,
      displayCategoryNos: [...form.category.displayCategoryNos],
      /**
       * 🔴 고른 적이 없으면 **키 자체를 만들지 않는다.** `selected: null`을 넣으면
       * 이 필드를 모르던 옛 스냅샷과 "번호를 손으로 친 상품"이 서로 다른 모양이
       * 되고, 그 차이가 아무 의미도 없는 채로 jsonb에 남는다.
       */
      ...(form.category.selected
        ? {
            selected: {
              name: form.category.selected.name,
              noticeItemCodes: [...form.category.selected.noticeItemCodes],
              safetyTypeCodes: [...form.category.selected.safetyTypeCodes],
            },
          }
        : {}),
    },
    notice: { itemCode: form.notice.itemCode, articlesText: form.notice.articlesText },
    certification: {
      safetyText: form.certification.safetyText,
      importProxyCode: form.certification.importProxyCode,
    },
    delivery: { ...form.delivery },
    codes: { ...form.codes },
  };
}

/**
 * 저장 → 폼. 키가 없는 과거 스냅샷(이 필드를 모르던 시절)에서는 빈 폼이 나온다 —
 * 섹션 단위로 기본값과 합치므로, 나중에 필드가 늘어도 옛 스냅샷이 `undefined`
 * 문자열을 입력칸에 넣지 않는다.
 */
export function fromLotteOnChannelInfo(info: LotteOnChannelInfo | undefined | null): LotteOnChannelForm {
  if (!info) return EMPTY_LOTTEON_CHANNEL_FORM;
  return {
    category: { ...EMPTY_LOTTEON_CHANNEL_FORM.category, ...info.category },
    notice: { ...EMPTY_LOTTEON_CHANNEL_FORM.notice, ...info.notice },
    certification: { ...EMPTY_LOTTEON_CHANNEL_FORM.certification, ...info.certification },
    delivery: { ...EMPTY_LOTTEON_CHANNEL_FORM.delivery, ...info.delivery },
    codes: { ...EMPTY_LOTTEON_CHANNEL_FORM.codes, ...info.codes },
  };
}

/* ── 표준카테고리를 바꾸는 **두 가지 길** ─────────────────────────────────
 *
 * 표준카테고리번호를 바꾸는 자리를 컴포넌트 안에 흩어 두지 않고 여기 둘로만
 * 둔다. 이유는 하나다 — 번호와 "그 번호가 요구하는 것"이 **갈라지면 안 된다.**
 * 추천에서 고른 카테고리의 안전인증 유형을, 셀러가 그 뒤에 손으로 바꿔 넣은
 * 다른 번호의 요구조건으로 말하기 시작하면 화면은 통과인데 등록은 거절되고,
 * 더 나쁘게는 **틀린 유형코드로 인증이 등록된다.**
 */

/**
 * 추천 후보를 고른 결과. **한 번에 네 가지가 채워진다** — 표준카테고리번호,
 * 전시카테고리, 고시 품목코드, 과세구분. 전부 205 응답 한 건에 같이 들어 있다.
 *
 * 여기서 저장에 남기는 것은 그중 번호들과 `selected` 세 줄뿐이다(카테고리 객체
 * 전체가 아니다 — LotteOnSelectedCategoryFacts 주석 참고).
 */
export function applyLotteOnRecommendedCategory(
  form: LotteOnChannelForm,
  category: LotteOnStandardCategory,
): LotteOnChannelForm {
  return {
    ...form,
    category: {
      standardCategoryNo: category.id,
      displayCategoryNos: category.displayCategories.map((entry) => entry.displayCategoryId),
      selected: {
        name: category.name,
        noticeItemCodes: [...category.noticeItemCodes],
        safetyTypeCodes: [...category.safetyTypeCodes],
      },
    },
    notice: { ...form.notice, itemCode: category.noticeItemCodes[0] ?? form.notice.itemCode },
    codes: { ...form.codes, taxTypeCode: category.taxTypeCode ?? form.codes.taxTypeCode },
  };
}

/**
 * 번호를 **직접** 넣는 길(입력칸에 치거나, 조회 결과를 누르거나).
 *
 * 🔴 이때 `selected`를 버린다. 우리는 이 번호가 무엇을 요구하는지 들은 적이
 * 없고, 직전 카테고리의 대답을 이 번호의 대답인 척 남겨 두면 그것이 곧
 * 오등록이다. 고시 품목코드/과세구분은 **지우지 않는다** — 이미 셀러의 입력이
 * 된 값이라 화면이 임의로 비우면 셀러가 넣은 값이 사라진다.
 */
export function setLotteOnStandardCategoryNo(form: LotteOnChannelForm, standardCategoryNo: string): LotteOnChannelForm {
  return {
    ...form,
    category: { ...form.category, standardCategoryNo, selected: null },
  };
}

/**
 * 지금 화면이 "선택한 표준카테고리가 알려준 것"이라고 말해도 되는가.
 *
 * 번호가 비어 있으면 알려준 것도 없다 — 셀러가 번호를 지웠는데 직전 카테고리의
 * 요구조건이 화면에 남아 있으면, 고르지도 않은 카테고리의 조건을 보게 된다.
 */
export function resolveLotteOnSelectedCategory(form: LotteOnChannelForm): LotteOnSelectedCategoryFacts | null {
  if (!form.category.standardCategoryNo.trim()) return null;
  return form.category.selected ?? null;
}

/** 상품 정보의 「커머스 관리정보」가 읽는 한 줄. 값이 없으면 null이다. */
export interface LotteOnManagedValueRow {
  label: string;
  value: string | null;
}

/**
 * 상품 정보 화면에 보여줄 롯데ON 관리정보 — **읽기 전용 요약**.
 *
 * 🔴 카테고리는 여기 없다(CEO 지시). 저장 타입에는 들어 있지만 이 함수가
 * 내보내지 않으므로, 상품 정보 화면이 롯데ON 카테고리를 보여주거나 고칠 경로가
 * 함수 수준에서 존재하지 않는다. 카테고리는 롯데ON 탭에서만 관리한다.
 */
export function summarizeLotteOnManagedValues(
  info: LotteOnChannelInfo | undefined | null,
): { rows: LotteOnManagedValueRow[]; filledCount: number } {
  /**
   * 🔴 info가 없으면 **빈 폼으로 채우지 않는다.** EMPTY_LOTTEON_CHANNEL_FORM에는
   * 관행 기본값(평일 마감 1400 · 과세 01)이 들어 있어서, 그걸로 메우면 아직
   * 아무것도 입력하지 않은 상품이 "2개 항목이 저장돼 있습니다"로 읽힌다.
   * "입력한 적 없음"과 "기본값으로 입력함"은 셀러에게 다른 문장이다.
   */
  const saved = info ? fromLotteOnChannelInfo(info) : null;
  const text = (value: string | undefined) => (value?.trim() ? value.trim() : null);
  const articles = parseNoticeArticles(saved?.notice.articlesText ?? "");
  const certifications = parseSafetyCertifications(saved?.certification.safetyText ?? "");
  const rows: LotteOnManagedValueRow[] = [
    { label: "고시 품목코드", value: text(saved?.notice.itemCode) },
    { label: "고시 항목", value: articles.length > 0 ? `${articles.length}건` : null },
    // 🔴 인증번호 원문은 여기에 적지 않는다 — 건수만 센다.
    { label: "안전인증", value: certifications.length > 0 ? `${certifications.length}건` : null },
    { label: "수입대행코드", value: text(saved?.certification.importProxyCode) },
    { label: "출고지번호", value: text(saved?.delivery.outboundPlaceNo) },
    { label: "반품지번호", value: text(saved?.delivery.returnPlaceNo) },
    { label: "배송비정책번호", value: text(saved?.delivery.deliveryCostPolicyNo) },
    { label: "배송가능지역코드", value: text(saved?.delivery.deliveryRegionGroupCode) },
    { label: "택배사코드", value: text(saved?.delivery.courierCode) },
    { label: "반품택배사코드", value: text(saved?.delivery.returnCourierCode) },
    { label: "평일 발송마감시간", value: text(saved?.delivery.weekdayCloseTime) },
    { label: "원산지코드", value: text(saved?.codes.originCode) },
    { label: "과세유형코드", value: text(saved?.codes.taxTypeCode) },
    { label: "브랜드번호", value: text(saved?.codes.brandNo) },
    { label: "업체상품번호", value: text(saved?.codes.externalProductNo) },
  ];
  return { rows, filledCount: rows.filter((row) => row.value != null).length };
}

/** "코드:값" 줄 단위 입력 → 고시 항목 배열. 코드체계를 우리가 만들지 않으므로
 * 셀러가 롯데ON 문서/판매자센터에서 본 코드를 그대로 적는다. */
export function parseNoticeArticles(raw: string): { pdArtlCd: string; pdArtlCnts: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator < 0) return null;
      return { pdArtlCd: line.slice(0, separator).trim(), pdArtlCnts: line.slice(separator + 1).trim() };
    })
    .filter((item): item is { pdArtlCd: string; pdArtlCnts: string } => Boolean(item?.pdArtlCd && item.pdArtlCnts));
}

/** "유형코드:인증번호[:기관명]" 줄 단위 입력. 인증번호는 절대 자동 생성하지 않는다. */
export function parseSafetyCertifications(
  raw: string,
): { sftyAthnTypCd: string; sftyAthnNo: string; sftyAthnOrgnNm?: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [typeCode, number, orgName] = line.split(":").map((part) => part.trim());
      if (!typeCode || !number) return null;
      return { sftyAthnTypCd: typeCode, sftyAthnNo: number, ...(orgName ? { sftyAthnOrgnNm: orgName } : {}) };
    })
    .filter((item): item is { sftyAthnTypCd: string; sftyAthnNo: string; sftyAthnOrgnNm?: string } => Boolean(item));
}

/** 쉼표/공백으로 구분된 전시카테고리 입력 → 번호 배열(중복 제거). */
export function parseDisplayCategoryNos(raw: string): string[] {
  const seen = new Set<string>();
  for (const value of raw.split(/[,\s]+/)) {
    const trimmed = value.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

/**
 * 유아동(품목코드 23)은 안전인증 없이 통과하지 못한다.
 *
 * 이 판정을 화면에 두는 이유는 **서버가 막기 전에 먼저 말하기 위해서**다.
 * 실제 차단은 여전히 서버(packages/listing/src/lotteon/validate-payload.ts)가
 * 하고, 여기서는 같은 규칙을 미리 보여주기만 한다 — 두 판정이 갈라지면 화면은
 * 통과인데 등록은 실패하는 그 상태가 된다. 규칙이 바뀌면 두 곳을 함께 고쳐라.
 */
export function requiresSafetyCertification(form: LotteOnChannelForm): boolean {
  return form.notice.itemCode.trim() === LOTTEON_CHILD_PRODUCT_ITEM_CODE;
}

/**
 * 화면 폼 → 서버(`/api/lotteon/payload-preview` · `/api/lotteon/register`)가
 * 받는 평평한 채널 입력.
 *
 * 서버 계약(LotteOnChannelFormInput)은 **한 줄도 바꾸지 않았다** — 화면이
 * 네 축으로 묶였을 뿐이다. 라우트를 건드리지 않았으므로 Preview와 Register가
 * 여전히 같은 buildLotteOnContext() 하나를 통과한다.
 */
export function toLotteOnChannelPayload(form: LotteOnChannelForm) {
  return {
    standardCategoryNo: form.category.standardCategoryNo.trim(),
    displayCategoryNos: form.category.displayCategoryNos.map((no) => no.trim()).filter(Boolean),

    noticeItemCode: form.notice.itemCode.trim(),
    noticeArticles: parseNoticeArticles(form.notice.articlesText),

    safetyCertifications: parseSafetyCertifications(form.certification.safetyText),
    importProxyCode: form.certification.importProxyCode.trim(),

    outboundPlaceNo: form.delivery.outboundPlaceNo.trim(),
    returnPlaceNo: form.delivery.returnPlaceNo.trim(),
    deliveryCostPolicyNo: form.delivery.deliveryCostPolicyNo.trim(),
    deliveryRegionGroupCode: form.delivery.deliveryRegionGroupCode.trim(),
    courierCode: form.delivery.courierCode.trim(),
    returnCourierCode: form.delivery.returnCourierCode.trim(),
    weekdayCloseTime: form.delivery.weekdayCloseTime.trim(),

    originCode: form.codes.originCode.trim(),
    taxTypeCode: form.codes.taxTypeCode.trim(),
    brandNo: form.codes.brandNo.trim(),
    externalProductNo: form.codes.externalProductNo.trim(),
  };
}

/* ── 공통 상품정보 — 읽기 전용 ─────────────────────────────────────────── */

export interface CommonProductRow {
  label: string;
  /** 이미 채워져 있는 값(사람이 읽는 형태). 비어 있으면 null. */
  value: string | null;
  /** 이 값이 어디서 왔는지 — "롯데ON 탭이 만든 값이 아니다"를 화면에 적기 위한 것. */
  origin: string;
  /** 등록에 반드시 필요한데 비어 있으면 true — 고치러 갈 곳은 공통 상품정보다. */
  missing: boolean;
}

export interface CommonProductSummary {
  rows: CommonProductRow[];
  /** 하나라도 비어 있으면 true. 롯데ON 탭에서 고칠 수 없다는 안내를 띄운다. */
  hasMissing: boolean;
}

function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/**
 * 롯데ON 등록에 **그대로 쓰이는** 공통 상품정보를 읽기 전용으로 요약한다.
 *
 * 🔴 여기서 값을 만들지 않는다. 상품명/이미지/옵션은 실제 payload를 만드는
 * build-payload.ts의 함수를 그대로 부르고, 가격은 화면이 이미 계산해 둔
 * resolveListingPrice() 결과(priceKrw)를 받기만 한다. 그래서 이 표가 payload와
 * 다른 말을 할 수 있는 경로가 없다.
 */
export function summarizeCommonProduct(
  product: CanonicalProduct,
  price: { priceKrw: number | null; resolved: boolean },
): CommonProductSummary {
  const name = resolveLotteOnProductName(product);
  const { representative, gallery } = resolveLotteOnImageUrls(product);
  const usesOptions = hasLotteOnSellableOptions(product) && product.variants.length > 0;
  const detailImageCount = product.images.filter(
    (image) => image.useInDescription && image.classification === "PRODUCT",
  ).length;
  const description = (product.descriptionKo.value || product.description.value).trim();
  const stock = product.stockQuantity.value ?? 0;

  const rows: CommonProductRow[] = [
    {
      label: "상품명",
      value: name || null,
      origin: "상품정보 · AI 한국어 제목(없으면 원문 제목)",
      missing: !name,
    },
    {
      // 브랜드는 롯데ON 등록 필수값이 아니다(등록에 쓰이는 것은 brdNo 코드다).
      // 그래도 요약에 두는 이유는 셀러가 "이 상품이 맞나"를 상품명만으로는
      // 확신하지 못하기 때문이다 — missing으로 세지 않는 이유도 같다. 여기서
      // ⚠를 켜면 등록을 막지 않는 항목이 등록 불가처럼 읽힌다.
      label: "브랜드",
      value: product.brand.value.trim() || null,
      origin: "상품정보 · 브랜드",
      missing: false,
    },
    {
      label: "대표이미지",
      value: representative ? `대표 1장 + 추가 ${Math.max(gallery.length - 1, 0)}장 (최대 10장)` : null,
      origin: "상품정보 · 이미지에서 갤러리로 선택한 것",
      missing: !representative,
    },
    {
      label: "상세페이지",
      value: description
        ? `본문 ${description.length}자 · 상세 이미지 ${detailImageCount}장 (판매자 공통 안내 포함)`
        : null,
      // 쿠팡/스마트스토어가 이미 함께 쓰는 조립 경로 그대로다 — 같은 판매자의
      // 같은 배송/반품 안내를 채널마다 다시 입력하게 하지 않는다.
      origin: "상품정보 · AI 상세설명 + 설정의 판매자 공통 상세블록",
      missing: !description,
    },
    {
      label: "판매가격",
      value: price.resolved && price.priceKrw != null ? formatKrw(price.priceKrw) : null,
      origin: "상품정보 · 가격 계산(resolveListingPrice) 결과 그대로",
      missing: !price.resolved || price.priceKrw == null || price.priceKrw <= 0,
    },
    {
      label: "옵션",
      value: usesOptions
        ? `${product.optionGroups.length}개 옵션 · 단품 ${product.variants.length}건`
        : "옵션 없음 — 단품 1건으로 등록",
      origin: "상품정보 · 크롤러가 실제로 확인한 옵션(조합을 만들어내지 않는다)",
      // 옵션이 없는 것은 결함이 아니다(단일 상품으로 등록된다).
      missing: false,
    },
    {
      label: "재고",
      value: usesOptions ? `단품별 재고 사용 (기본 ${stock}개)` : `${stock}개`,
      origin: "상품정보 · 재고 수량",
      missing: stock <= 0 && !usesOptions,
    },
  ];

  return { rows, hasMissing: rows.some((row) => row.missing) };
}

/* ── 공통 카테고리 → 롯데ON 카테고리 매핑의 "출처" 쪽 ────────────────────── */

export interface CommonCategorySource {
  /** 사람이 읽는 분류 경로. */
  path: string[];
  /** 이 분류가 어디서 왔는지. */
  origin: string;
}

/**
 * 롯데ON 표준/전시 카테고리를 고를 때 **참고할 공통 분류**를 모은다.
 *
 * 🔴 이 함수는 아무것도 쓰지 않는다(순수 읽기). 롯데ON 탭이 고른 번호가
 * categoryMappings로 흘러들어갈 경로 자체를 만들지 않기 위해, 반환 타입에
 * CategorySelection이 들어가지 않는다 — 화면에 보여줄 문자열만 나간다.
 *
 * 순서에 의미가 있다: 먼저 **상품 자신의 분류**(원본 사이트 breadcrumb /
 * JSON-LD)를 놓고, 그다음 다른 채널에서 셀러가 이미 확정한 카테고리를 놓는다.
 * 다른 채널 값이 앞에 오면 "쿠팡 카테고리가 곧 공통 카테고리"라는 잘못된
 * 인상을 주고, 그게 세 번째 시스템이 생기는 첫걸음이다.
 */
export function resolveCommonCategorySources(
  product: CanonicalProduct,
  categoryMappings: Partial<Record<PlatformId, CategorySelection>>,
  options: { order: PlatformId[]; labelOf: (id: PlatformId) => string },
): CommonCategorySource[] {
  const sources: CommonCategorySource[] = [];

  const breadcrumb = (product.breadcrumbPath ?? []).map((part) => part.trim()).filter(Boolean);
  if (breadcrumb.length > 0) {
    sources.push({ path: breadcrumb, origin: "원본 상품 페이지 분류" });
  }

  const jsonLd = product.jsonLdCategory?.trim();
  if (jsonLd) {
    sources.push({ path: [jsonLd], origin: "원본 상품 구조화 데이터" });
  }

  for (const platformId of options.order) {
    const selection = categoryMappings[platformId];
    // 확정(SELECTED/CONFIRMED)된 것만 쓴다 — 추천이 떠 있을 뿐인 값을 "셀러가
    // 정한 분류"로 보여주면, 셀러가 고른 적 없는 카테고리를 근거로 롯데ON
    // 카테고리를 고르게 된다(이 저장소가 이미 여러 번 겪은 실수다).
    if (!selection?.candidate) continue;
    if (selection.state !== "SELECTED" && selection.state !== "CONFIRMED") continue;
    const path = selection.candidate.path.filter(Boolean);
    if (path.length === 0) continue;
    sources.push({ path, origin: `${options.labelOf(platformId)}에서 확정한 카테고리(참고용)` });
  }

  return sources;
}

/* ── 카테고리 조회 결과 표시(최선 노력) ──────────────────────────────────── */

export interface LotteOnCategoryOption {
  code: string;
  name: string;
}

/**
 * onpick 205/206 응답 한 건에서 "번호 + 이름"을 뽑는다.
 *
 * ── 이 함수는 더 이상 추측이 아니다(SPRINT 4, 2026-09-14) ──────────────────
 * SPRINT 3까지 이 함수는 필드명을 **정규식으로 짐작**했다(`…no$` / `…nm$`).
 * 그 짐작은 틀렸다는 것이 문서 원문으로 확인됐다. 205 Response Sample의 첫
 * 필드는 `depth_no`(깊이번호)이고, 옛 정규식 `/(^|_)(scat|dcat|cat)?_?no$/i`가
 * 여기에 먼저 걸린다 — **표준카테고리번호 칸에 "3"(깊이)을 넣는다.** 206도
 * 같은 이유로 깊이가 들어간다. 셀러가 조회 결과를 눌렀을 때 등록에 쓰이는
 * 번호가 카테고리 번호가 아니게 되는, 조용한 오등록 경로였다.
 *
 * 이제 문서 원문의 필드명(205 std_cat_id/std_cat_nm · 206 disp_cat_id/
 * disp_cat_nm)으로만 읽는다 — 파싱 규칙은 lotteon-category.ts 한 곳에 있고,
 * 여기서는 "둘 중 하나로 읽히면 선택지, 아니면 null"만 결정한다.
 *
 * ⚠️ 실동작으로는 아직 한 번도 호출하지 못했다(조사 §13-2). 그래서 **못
 * 알아보면 여전히 null**이고, 화면은 그때 응답 원문을 그대로 보여준다.
 * 지어낸 필드명으로 빈 목록을 그려 "카테고리가 없다"고 말하지 않는다.
 */
export function describeLotteOnCategoryItem(item: unknown): LotteOnCategoryOption | null {
  const standard = parseLotteOnStandardCategory(item);
  if (standard) return { code: standard.id, name: standard.name };
  const display = parseLotteOnDisplayCategory(item);
  if (display) return { code: display.id, name: display.name };
  return null;
}

/* ── 등록 가능성 · 부족한 정보 ────────────────────────────────────────────── */

/** 서버(validate-payload.ts)가 돌려주는 필드 판정 한 줄. 화면은 이 모양만 안다. */
export interface LotteOnValidationField {
  field: string;
  label: string;
  status: "READY" | "MISSING" | "BLOCKED";
  reason?: string;
  code?: string;
}

export interface LotteOnValidationSnapshot {
  ok: boolean;
  fields: LotteOnValidationField[];
  readyCount: number;
  missingCount: number;
  blockedCount: number;
}

export interface LotteOnRegistrationReadiness {
  /** 0~100. **필수 충족률**이다 — 롯데ON 검증에는 선택 항목이 없다
   * (validate-payload.ts의 ok는 missing===0 && blocked===0). */
  percent: number;
  total: number;
  readyCount: number;
  /** 등록 버튼의 게이트. percent===100과 같은 뜻이지만 둘 다 따로 계산하지
   * 않는다 — 여기 한 값에서 나온다. */
  allRequiredPassed: boolean;
}

/**
 * 등록 가능성.
 *
 * 🔴 **여기서 새로 판정하지 않는다.** 서버 검증 결과(validateLotteOnPayload)를
 * 세기만 한다. 화면이 자기만의 규칙으로 퍼센트를 계산하기 시작하면 "카드는
 * 100%인데 등록은 실패"(이 저장소의 CP001 버그)가 롯데ON에서 재발한다.
 *
 * validation이 없으면(아직 확인 전) 0%다 — 모르는 것을 "가능"으로 낙관하지
 * 않는다. readiness.ts의 computeNaverPayloadReadiness(null)과 같은 처리다.
 */
export function computeLotteOnRegistrationReadiness(
  validation: LotteOnValidationSnapshot | null,
): LotteOnRegistrationReadiness {
  if (!validation || validation.fields.length === 0) {
    return { percent: 0, total: 0, readyCount: 0, allRequiredPassed: false };
  }
  const total = validation.fields.length;
  const readyCount = validation.fields.filter((field) => field.status === "READY").length;
  return {
    percent: Math.round((readyCount / total) * 100),
    total,
    readyCount,
    // 서버가 계산한 ok를 그대로 쓴다(세어서 다시 만들지 않는다).
    allRequiredPassed: validation.ok,
  };
}

/**
 * §17 — 카테고리를 고르기 전인가.
 *
 * 롯데ON에서 표준카테고리는 "분류 하나"가 아니라 **요구조건의 출처**다. 205
 * 응답 한 건이 전시카테고리 · 고시 품목코드 · 과세구분 · 요구 안전인증 유형을
 * 함께 들고 온다(조사 §14-2). 그래서 카테고리를 고르기 전의 필수 항목 수는
 * "아직 이 상품에 무엇이 요구되는지 모르는 상태에서 센 수"다 — 그 수로 만든
 * 퍼센트를 등록 가능성이라고 부르면, 카테고리를 고른 순간 요구조건이 늘어나
 * 숫자가 거꾸로 내려간다. 셀러에게는 "준비가 풀렸다"로 읽힌다.
 *
 * 그래서 이 시점에는 숫자를 **말하지 않는다**(0%도 말하지 않는다 — 0%는
 * "다 모자라다"는 판정이고, 여기서 참인 것은 "아직 판단할 수 없다"이다).
 */
export function isLotteOnCategoryChosen(form: LotteOnChannelForm): boolean {
  return form.category.standardCategoryNo.trim().length > 0;
}

/**
 * §18 — **실제로 등록을 막는 필수 조건**만 추린다. 퍼센트보다 먼저 보여줄 값이다.
 *
 * 🔴 새로 판정하지 않는다. 서버 검증 결과(validateLotteOnPayload)에서 READY가
 * 아닌 줄을 고르기만 한다 — 화면이 서버보다 낙관적으로 말할 경로를 만들지
 * 않기 위해서다(computeLotteOnRegistrationReadiness와 같은 원칙).
 *
 * BLOCKED가 MISSING보다 앞에 온다. 둘 다 등록을 막지만, BLOCKED는 셀러가
 * 이 화면에서 채워서 풀 수 없는 것(우리가 만들 수 없는 값이거나 지금 보내면
 * 잘못된 등록이 되는 것)이라 먼저 알아야 한다.
 */
export function listLotteOnBlockingConditions(
  validation: LotteOnValidationSnapshot | null,
): LotteOnValidationField[] {
  if (!validation) return [];
  const rank = (field: LotteOnValidationField) => (field.status === "BLOCKED" ? 0 : 1);
  return validation.fields.filter((field) => field.status !== "READY").sort((a, b) => rank(a) - rank(b));
}

/** 부족한 항목을 **어디서** 채우는가. 이 값이 §8 안내의 핵심이다 —
 * "입력하세요"가 아니라 "여기로 가세요"를 말하기 위한 것. */
export type LotteOnFixLocation =
  /** 공통 상품정보(상품정보 탭). 롯데ON 탭에서는 고칠 수 없다. */
  | "COMMON_PRODUCT"
  /** 이 탭의 롯데ON 등록 정보 섹션. */
  | "LOTTEON_TAB"
  /** 설정 화면(인증키 등). */
  | "SETTINGS"
  /** 롯데ON 판매자센터에 먼저 등록해야 생기는 값 — 우리가 만들 수 없다. */
  | "LOTTEON_SELLER_CENTER";

export interface LotteOnMissingInfoItem {
  /** validate-payload.ts의 field 값 그대로. */
  key: string;
  label: string;
  /** **왜** 이 정보가 필요한가. */
  why: string;
  /** **무엇을** 채워야 하는가. */
  what: string;
  where: LotteOnFixLocation;
  /** 이 탭 안에서 스크롤할 섹션 앵커(있을 때만). */
  sectionId?: string;
  /** BLOCKED — CartPilot이 만들어낼 수 없는 값이거나 지금 보내면 잘못된 등록이 된다. */
  blocking: boolean;
}

/**
 * "어디서 · 왜" 표 — **validate-payload.ts의 field 이름을 키로 쓴다.**
 *
 * 필드 목록을 여기서 새로 정하지 않는다는 뜻이다. 서버가 판정한 필드에 대해
 * "어디로 가면 되는가"만 덧붙인다. 서버가 새 필드를 판정하기 시작하면 여기에
 * 없으므로 아래 기본 안내로 떨어진다 — 화면이 그 필드를 **빠뜨리지는 않는다**.
 */
const LOTTEON_FIX_GUIDE: Record<string, Omit<LotteOnMissingInfoItem, "key" | "label" | "blocking">> = {
  trNo: {
    why: "롯데ON은 모든 상품을 거래처 단위로 받습니다 — 거래처번호 없이는 상품이 누구 것인지 정해지지 않습니다.",
    what: "설정에서 롯데ON 인증키를 저장하고, 판매자센터에 우리 서버 IP가 등록돼 있는지 확인해 주세요. 거래처 정보는 저장하지 않고 등록할 때마다 롯데ON에 직접 물어봅니다.",
    where: "SETTINGS",
  },
  scatNo: {
    why: "롯데ON 카테고리 코드는 스마트스토어·쿠팡과 완전히 다른 체계라 기존 카테고리를 그대로 쓸 수 없습니다.",
    what: "아래 [카테고리 추천]을 누르면 이 상품에 맞는 표준카테고리 후보를 보여드립니다.",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-category",
  },
  dcatLst: {
    why: "롯데ON은 표준카테고리(상품이 무엇인가)와 전시카테고리(어느 매대에 걸 것인가)를 함께 요구합니다.",
    what: "표준카테고리를 먼저 고르면 거기에 매핑된 전시카테고리가 함께 따라옵니다 — 그중 1개 이상을 고르면 됩니다.",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-category",
  },
  pdItmsCd: {
    why: "상품정보제공고시는 법적 필수이고, 품목마다 요구 항목이 다릅니다.",
    what: "표준카테고리를 고르면 그 카테고리의 고시 품목코드가 함께 옵니다 — 따로 찾지 않아도 됩니다.",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-notice",
  },
  pdItmsArtlLst: {
    why: "고시 항목이 비어 있으면 롯데ON이 상품정보 승인을 내주지 않습니다.",
    what: "항목코드는 품목마다 체계가 달라 우리가 만들지 않습니다. 내용은 상품정보에 이미 있는 값(소재·색상·제조사·원산지 등)을 그대로 쓰면 됩니다 — 아래에 그 값들을 모아 두었습니다.",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-notice",
  },
  sftyAthnLst: {
    why: "이 카테고리는 KC 안전인증이 있어야 팔 수 있습니다. 인증 없이 등록하면 판매중지 대상입니다.",
    what: "실제로 취득한 인증번호를 입력해야 합니다 — 어떤 경우에도 자동으로 만들지 않습니다. 상품정보에 어린이제품 인증을 이미 입력해 두셨다면 그 값을 그대로 가져다 쓸 수 있습니다.",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-certification",
  },
  impPrxCd: {
    why: "선택한 안전인증 유형은 롯데ON이 수입 형태를 함께 요구합니다.",
    what: "구매대행(PUR_PRX) · 병행수입(PRL_IMP) · 해당없음(NONE) 중 하나를 고르세요.",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-certification",
  },
  oplcCd: {
    why: "원산지는 법적 표시 의무 항목입니다.",
    what: "상품정보의 원산지 텍스트만으로는 롯데ON 코드를 정할 수 없습니다 — 롯데ON 원산지코드(공통코드 OPLC_CD)를 골라 주세요.",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-codes",
  },
  owhpNo: {
    why: "출고지가 없으면 주문이 들어와도 어디서 보내는 물건인지 롯데ON이 알 수 없습니다.",
    what: "롯데ON 판매자센터에서 출고지를 먼저 등록하면 번호가 생깁니다 — 우리가 만들 수 없는 값입니다.",
    where: "LOTTEON_SELLER_CENTER",
    sectionId: "lotteon-section-delivery",
  },
  rtrpNo: {
    why: "반품지가 없으면 반품 요청을 받을 수 없습니다.",
    what: "롯데ON 판매자센터에서 회수지를 먼저 등록하면 번호가 생깁니다.",
    where: "LOTTEON_SELLER_CENTER",
    sectionId: "lotteon-section-delivery",
  },
  dvCstPolNo: {
    why: "배송비 정책이 없으면 고객에게 청구할 배송비가 정해지지 않습니다.",
    what: "롯데ON 판매자센터에서 배송비 정책을 먼저 등록하면 번호가 생깁니다.",
    where: "LOTTEON_SELLER_CENTER",
    sectionId: "lotteon-section-delivery",
  },
  dvRgsprGrpCd: {
    why: "배송 가능 지역이 없으면 도서산간 주문 처리 기준이 정해지지 않습니다.",
    what: "롯데ON 공통코드 DV_RGSPR_GRP_CD 값을 넣어 주세요.",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-delivery",
  },
  nldySndCloseTm: {
    why: "발송마감시간은 고객에게 보이는 도착 예정일의 기준입니다.",
    what: "HHMM 형식이고 분은 00 또는 30만 쓸 수 있습니다(예: 1400).",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-delivery",
  },
  satSndCloseTm: {
    why: "토요일 발송을 켜면 토요일 마감시간이 함께 있어야 합니다.",
    what: "HHMM 형식이고 분은 00 또는 30만 쓸 수 있습니다.",
    where: "LOTTEON_TAB",
    sectionId: "lotteon-section-delivery",
  },
  // ── 아래부터는 롯데ON 탭에서 고칠 수 없는 것들이다(공통 상품정보) ──────
  spdNm: {
    why: "상품명 없이는 등록할 수 없습니다.",
    what: "상품정보 탭에서 상품명을 채우면 스마트스토어·쿠팡·롯데ON에 함께 반영됩니다.",
    where: "COMMON_PRODUCT",
  },
  slPrc: {
    why: "판매가격이 정해지지 않으면 0원으로 등록될 수 있습니다.",
    what: "상품정보 탭의 가격에서 원본 가격과 환율을 확인해 주세요. 롯데ON 탭은 그 결과를 그대로 씁니다 — 여기서 다시 계산하지 않습니다.",
    where: "COMMON_PRODUCT",
  },
  itmImgLst: {
    why: "대표 이미지가 없으면 상품이 목록에 노출되지 않습니다.",
    what: "상품정보 탭의 이미지에서 갤러리에 쓸 이미지를 지정해 주세요(롯데ON은 jpg/jpeg/png만, 단품당 최대 10장).",
    where: "COMMON_PRODUCT",
  },
  epnLst: {
    why: "상품기술서(상세페이지)가 비어 있으면 구매자가 판단할 근거가 없습니다.",
    what: "상품정보 탭의 상세설명과 설정의 판매자 공통 상세블록에서 채웁니다 — 채널마다 따로 쓰지 않습니다.",
    where: "COMMON_PRODUCT",
  },
  itmLst: {
    why: "판매할 단품(옵션)이 정해져야 재고와 가격이 붙습니다.",
    what: "상품정보 탭의 옵션을 확인해 주세요. 옵션 조합을 임의로 만들어내지 않습니다.",
    where: "COMMON_PRODUCT",
  },
  slStrtDttm: {
    why: "롯데ON은 판매 시작/종료일시를 둘 다 요구합니다.",
    what: "등록 시점에 자동으로 채워집니다 — 이 항목이 비어 있으면 시스템 문제이므로 다시 [등록 정보 확인]을 눌러 주세요.",
    where: "LOTTEON_TAB",
  },
};

const FALLBACK_FIX_GUIDE: Omit<LotteOnMissingInfoItem, "key" | "label" | "blocking"> = {
  why: "롯데ON이 이 항목을 등록 필수로 요구합니다.",
  what: "아래 등록 정보 확인 결과의 사유를 확인해 주세요.",
  where: "LOTTEON_TAB",
};

/**
 * §8 — **부족한 정보 안내.**
 *
 * "카테고리를 확정해주세요"로 끝내지 않는다. 항목마다 **왜 필요한지 + 무엇을
 * 어디서 채워야 하는지**를 함께 말한다. 목록의 출처는 서버 검증 결과 하나뿐이라
 * 화면이 서버와 다른 목록을 보여줄 수 없다.
 *
 * 순서는 **어디서 고치는가**로 묶는다. BLOCKED/MISSING으로 먼저 나누지 않는
 * 이유는, 둘 다 똑같이 등록을 막기 때문이다(validate-payload.ts의 ok는
 * missing===0 && blocked===0) — 셀러에게 그 구분은 "어느 화면으로 가야 하나"
 * 만큼 쓸모 있지 않다.
 *
 * 공통 상품정보가 맨 앞이다: 공통을 고치면 스마트스토어·쿠팡·롯데ON이 함께
 * 해결되는데, 채널 고유값부터 채우면 같은 일을 세 번 하게 된다. 같은 자리
 * 안에서는 막는 것(BLOCKED)이 먼저 온다.
 */
export function buildLotteOnMissingInfo(validation: LotteOnValidationSnapshot | null): LotteOnMissingInfoItem[] {
  if (!validation) return [];
  const items = validation.fields
    .filter((field) => field.status !== "READY")
    .map((field) => {
      const guide = LOTTEON_FIX_GUIDE[field.field] ?? FALLBACK_FIX_GUIDE;
      return {
        key: field.field,
        label: field.label,
        // 서버가 준 사유가 있으면 그것이 더 구체적이다 — 표의 문장으로 덮지 않고
        // 뒤에 붙인다(둘이 다른 말을 하면 서버 쪽이 사실이다).
        why: field.reason ? `${guide.why} (${field.reason})` : guide.why,
        what: guide.what,
        where: guide.where,
        sectionId: guide.sectionId,
        blocking: field.status === "BLOCKED",
      };
    });
  const WHERE_ORDER: Record<LotteOnFixLocation, number> = {
    COMMON_PRODUCT: 0,
    SETTINGS: 1,
    LOTTEON_TAB: 2,
    LOTTEON_SELLER_CENTER: 3,
  };
  const rank = (item: LotteOnMissingInfoItem) => WHERE_ORDER[item.where] * 10 + (item.blocking ? 0 : 1);
  return items.sort((a, b) => rank(a) - rank(b));
}

/** 안내 문구용 — 어디로 가야 하는지 한 단어. */
export const LOTTEON_FIX_LOCATION_LABEL: Record<LotteOnFixLocation, string> = {
  COMMON_PRODUCT: "상품정보",
  LOTTEON_TAB: "이 탭",
  SETTINGS: "설정",
  LOTTEON_SELLER_CENTER: "롯데ON 판매자센터",
};

/* ── 고시 내용으로 쓸 수 있는 공통 값 ────────────────────────────────────── */

export interface LotteOnNoticeSourceValue {
  label: string;
  value: string;
}

/**
 * 고시 항목의 **내용**으로 쓸 수 있는 값이 상품정보에 이미 무엇이 있는지 모은다.
 *
 * ── 왜 이것이 필요한가 ────────────────────────────────────────────────────
 * 스마트스토어는 고시(productInfoProvidedNotice)를 CanonicalProduct에서
 * **전부 자동으로 만든다**(소재·색상·사이즈·제조사·취급방법·품명·모델명…).
 * 쿠팡도 같은 값을 동의어 매칭으로 채운다. 그런데 롯데ON 탭은 지금까지
 * `0020:색상` 같은 줄을 셀러가 **손으로 다시 치게** 했다 — 같은 값이 시스템
 * 안에 이미 있는데도.
 *
 * 항목코드(pdArtlCd) 체계는 품목마다 달라 우리가 만들지 않는다(그 판단은
 * 그대로 유지한다). 하지만 **내용**은 이미 있다. 그래서 여기서는 코드가 아니라
 * "쓸 수 있는 값"만 모아서 화면에 보여주고, 셀러가 코드만 붙이면 되게 한다.
 *
 * 🔴 값을 **고치지 않는다.** 읽기만 한다 — 이 함수에는 setter가 없다.
 */
export function collectLotteOnNoticeSourceValues(product: CanonicalProduct): LotteOnNoticeSourceValue[] {
  const sizeValues = product.optionGroups
    .filter((group) => /size|사이즈/i.test(group.name))
    .flatMap((group) => group.values)
    .map((value) => value.trim())
    .filter(Boolean);

  const rows: LotteOnNoticeSourceValue[] = [
    { label: "소재", value: product.material.value },
    { label: "색상", value: product.color.value },
    { label: "치수(사이즈)", value: sizeValues.join(", ") },
    { label: "제조사", value: product.manufacturer.value },
    { label: "제조국/원산지", value: product.countryOfOrigin.value },
    { label: "취급 시 주의사항", value: product.careInstructions.value },
    { label: "권장 연령", value: product.recommendedAge.value },
    { label: "품명", value: product.itemName.value },
    { label: "모델명", value: product.modelName.value },
    { label: "수입사", value: product.importer.value },
    { label: "KC 인증 유형", value: product.certificationType.value },
  ];
  return rows.map((row) => ({ ...row, value: row.value?.trim() ?? "" })).filter((row) => row.value.length > 0);
}

/**
 * 상품정보에 이미 들어 있는 **어린이제품 인증**을 롯데ON 안전인증 입력 형식
 * (`유형코드:인증번호[:기관명]`)으로 옮겨 적어 준다.
 *
 * 🔴 인증번호를 만들지 않는다. `product.childCertification`은 셀러가 직접
 * 입력한 실제 인증 정보이고(스마트스토어가 productCertificationInfos로 쓰는
 * 바로 그 값), 여기서는 형식만 바꿔 담는다. 유형코드는 **우리가 정할 수 없다**
 * — 인자로 받은 값(카테고리가 알려준 유형)만 쓰고, 없으면 null을 돌려준다.
 */
export function buildLotteOnSafetyLineFromCommon(
  product: CanonicalProduct,
  safetyTypeCode: string | null | undefined,
): string | null {
  const certification = product.childCertification.value;
  if (!certification) return null;
  const number = certification.certificationNumber?.trim();
  if (!number) return null;
  const typeCode = safetyTypeCode?.trim();
  if (!typeCode) return null;
  const organization = (certification.name ?? certification.companyName ?? "").trim();
  return organization ? `${typeCode}:${number}:${organization}` : `${typeCode}:${number}`;
}
