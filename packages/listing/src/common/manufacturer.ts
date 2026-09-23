/**
 * REWORK-10 A(CEO 지시, 2026-09-15) — **제조사는 전 채널 공통 resolver 하나다.**
 * REWORK-13A(CEO 지시, 2026-09-15) — **그 하나가 다섯 단계를 센다.**
 *
 * ── 왜 이 파일이 생겼나 ──────────────────────────────────────────────────
 * 폴백 사슬 자체는 세 채널에 이미 다 있었다. 그런데 **세 벌이었다**:
 *
 *   쿠팡    coupang/build-payload.ts
 *           `product.manufacturer.value || brandProfile?.manufacturer || sellerConfig.manufacturer`
 *   네이버  naver/build-payload.ts + api/naver/_lib/resolve-context.ts
 *           `product.manufacturer.value.trim() || resolvedManufacturer`
 *   롯데ON  lotteon/build-payload.ts
 *           `product.manufacturer.value.trim()` — **폴백이 아예 없었다**
 *
 * ── REWORK-13A 가 바꾼 것 ────────────────────────────────────────────────
 * CEO Production 확인 결과 두 가지가 지시됐다.
 *
 *   1. **"제조사 미확인 = 등록 차단" 구조를 없앤다.**  이 파일은 판정만 하고
 *      아무것도 막지 않는다 — 막는 자리는 채널 validator 한 곳뿐이고, 그것도
 *      "그 채널 API 가 진짜 필수로 요구하는가"만 본다.
 *   2. **자동 추정 단계를 다섯 개로 센다.**  예전 세 단계(①상품 원문 → ②브랜드
 *      프로필 → ③판매자 기본정보)에서 ①이 두 가지를 한 이름으로 덮고 있었다:
 *      «원본 URL 이 구조화 데이터로 명시한 제조사»와 «상품 설명문에서 문구로
 *      확인한 제조사»는 신뢰도가 다른데 화면이 둘을 구분해 말할 수 없었다.
 *
 *   ① SOURCE_URL      원본 URL 의 명시적 제조사
 *                     (JSON-LD/microdata `Product.manufacturer`,
 *                      additionalProperty 「제조사」— crawler 가 채운다)
 *   ② PRODUCT_INFO    원본 상품정보 · 구조화 데이터 · 브랜드 관련 데이터에서
 *                     **명시적으로** 확인된 제조사
 *                     (설명문의 "Manufactured by X" / "제조자: X")
 *   ③ BRAND_DEFAULT   설정 > 브랜드 관리의 제조사
 *   ④ SELLER_DEFAULT  판매자 기본 제조사
 *   ⑤ MANUAL          셀러가 이 상품에 직접 입력한 값
 *   ─ NONE            어느 단계도 답하지 못했다
 *
 * **어느 단계에서든 값이 잡히면 자동 적용한다.**
 *
 * ── ⑤ 가 왜 목록 맨 아래인데 우선순위는 맨 위인가 ───────────────────────
 * 위 번호는 «자동으로 찾아보는 순서»다 — ①~④를 다 찾아봐도 답이 없을 때
 * 셀러가 ⑤로 직접 채운다. 하지만 셀러가 실제로 값을 친 순간 그것은 «추정»이
 * 아니라 «확정»이다. 자동 추정과 셀러 최종 확인은 분리돼야 하므로(CEO 핵심
 * 원칙), 직접 입력한 값은 항상 모든 추정을 이긴다.
 *
 * ── 🔴 절대 하지 않는 것 ─────────────────────────────────────────────────
 *   ❌ 브랜드명을 제조사로 복사하지 않는다("Bobo Choses" → "Bobo Choses S.L."
 *      같은 추론 금지). ③은 셀러가 브랜드 관리에 **직접 적어 둔** 제조사이지
 *      브랜드명이 아니다.
 *   ❌ 근거 없는 제조사명을 만들지 않는다. NONE 은 "빈 문자열"이 아니라
 *      **판정**이다 — 화면은 이 판정을 보고 "어디까지 찾아봤는지"를 말한다.
 *
 * ── 🔴 쿠팡 payload는 이 파일을 import하지 않는다 ────────────────────────
 * 쿠팡 등록 경로는 지금 유일하게 실증된 성공 경로라 diff 0으로 유지한다(CEO
 * 금지 항목). 대신 아래 `resolveManufacturer()`가 쿠팡의 `||` 사슬과 **문자
 * 그대로 같은 결과**를 낸다는 것을 테스트가 고정한다
 * (__tests__/manufacturer-resolver.test.ts).
 */

/** 제조사를 채운 단계. 화면이 "어디서 온 값인가"를 말할 때 쓰는 유일한 축이다. */
import type { InputMode } from "@commerce/shared";

export type ManufacturerSource =
  /** ⑤ 셀러가 이 상품에 직접 입력한 값 — 추정이 아니라 확정이라 항상 최우선. */
  | "MANUAL"
  /** ① 원본 URL 이 구조화 데이터로 명시한 제조사. */
  | "SOURCE_URL"
  /** ② 원본 상품정보에서 문구로 명시 확인된 제조사. */
  | "PRODUCT_INFO"
  /** ③ 설정 > 브랜드 관리의 제조사. */
  | "BRAND_DEFAULT"
  /** ④ 판매자 기본 제조사. */
  | "SELLER_DEFAULT"
  /** 🔴 PIVOT NEXT-04c — 셀러가 «상세페이지 참조로 등록하겠다» 고 정한 상태.
   *
   * 「값이 없다」가 아니다. 이미 «채워진» 것이고, 그래서 아래 단계로 내려가지
   * 않는다. 예전에는 value 가 비어 있다는 이유로 브랜드·판매자 기본값까지
   * 내려갔고, 그 결과 같은 화면에서 ①기본정보는 판매자 기본값을, 고시정보는
   * 참조 문구를 보여 줬다. */
  | "DETAIL_REFERENCE"
  /** 어느 단계도 답하지 못했다. */
  | "NONE";

/**
 * `CanonicalProduct.manufacturerOrigin` 과 같은 축이다 — 크롤러가 제조사를
 * **어디서** 읽었는지(①인가 ②인가)를 canonical 단계에서 한 번 기록해 두고,
 * resolver 는 그것을 그대로 읽는다. 여기서 다시 추론하지 않는다.
 */
export type ManufacturerOrigin = "SOURCE_URL" | "PRODUCT_INFO";

export interface ManufacturerResolution {
  /** 실제로 payload에 들어갈 값. NONE이면 빈 문자열이다(지어낸 값이 아니다). */
  value: string;
  source: ManufacturerSource;
  /** 값을 찾았는가. `source !== "NONE"`과 같은 뜻 — 호출부의 조건문을 짧게 하려고 둔다. */
  resolved: boolean;
}

export interface ManufacturerResolverInput {
  /** ⑤ 셀러가 이 상품에 직접 입력한 값(product.manufacturer.source === "USER_EDITED"). */
  manualManufacturer?: string | null;
  /** ① 원본 URL 의 명시적 제조사. */
  sourceUrlManufacturer?: string | null;
  /** ② 원본 상품정보에서 명시적으로 확인된 제조사. */
  productInfoManufacturer?: string | null;
  /** ③ 브랜드 관리(BrandProfile.manufacturer). */
  brandProfileManufacturer?: string | null;
  /** ④ 판매자 기본정보(SellerProfile.manufacturer). */
  sellerProfileManufacturer?: string | null;
  /** 🔴 상품의 제조사 칸이 «어떤 입력 방식» 인가(interpretField 결과).
   *
   * 값이 아니라 «방식» 이라 다른 후보들과 같은 줄에 둘 수 없다. 이것이
   * DETAIL_REFERENCE 면 폴백 자체가 일어나지 않는다. */
  productInputMode?: InputMode | "UNRESOLVED";
  /**
   * @deprecated REWORK-13A 이전의 이름. «상품이 들고 있는 제조사»를 ①/②/⑤로
   * 나누기 전에는 이 한 칸이 전부였다. 출처를 모르는 값이므로 ②로 취급한다 —
   * 호출부는 `manufacturerInputFromProduct()`를 쓰는 것이 옳다.
   */
  productManufacturer?: string | null;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * 전 채널 공통 제조사 resolver. 순수함수 — DB도 네트워크도 모른다(값을 조회해
 * 오는 것은 호출부의 책임이다. build-payload.ts들이 brandProfile을 인자로
 * 받는 것과 같은 규칙).
 *
 * 🔴 이 함수는 아무것도 막지 않는다. `resolved: false`는 "등록 불가"가 아니라
 * "자동으로는 못 찾았다"는 뜻이다(REWORK-13A).
 */
export function resolveManufacturer(input: ManufacturerResolverInput): ManufacturerResolution {
  const manual = clean(input.manualManufacturer);
  if (manual) return { value: manual, source: "MANUAL", resolved: true };

  const sourceUrl = clean(input.sourceUrlManufacturer);
  if (sourceUrl) return { value: sourceUrl, source: "SOURCE_URL", resolved: true };

  const productInfo = clean(input.productInfoManufacturer) || clean(input.productManufacturer);
  if (productInfo) return { value: productInfo, source: "PRODUCT_INFO", resolved: true };

  /* 🔴 PIVOT NEXT-04c — 여기서 «멈춘다».
     셀러가 「상세페이지 참조로 등록」을 고른 상태다. 값이 비어 있지만 그건
     「아직 없다」가 아니라 «이미 채웠다» 는 뜻이다. 아래로 내려가면 브랜드·
     판매자 기본값이 잡히고, 그러면 같은 화면에서 ①기본정보와 고시정보가 서로
     다른 제조사를 말하게 된다(실측으로 확인된 P0).

     상품 단계(①②⑤)보다 «뒤» 에 두는 이유: 셀러가 실제 값을 넣어 뒀다면 그게
     참조보다 우선이다. 참조는 「값을 못/안 넣기로 한 선택」이라 값이 있으면
     애초에 성립하지 않는다. */
  if (input.productInputMode === "DETAIL_REFERENCE") {
    return { value: "", source: "DETAIL_REFERENCE", resolved: true };
  }

  const brand = clean(input.brandProfileManufacturer);
  if (brand) return { value: brand, source: "BRAND_DEFAULT", resolved: true };

  const seller = clean(input.sellerProfileManufacturer);
  if (seller) return { value: seller, source: "SELLER_DEFAULT", resolved: true };

  return { value: "", source: "NONE", resolved: false };
}

/**
 * `CanonicalProduct.manufacturer`(값 + provenance)와 `manufacturerOrigin`을
 * resolver 입력의 ①/②/⑤ 세 칸으로 옮긴다.
 *
 * 세 채널 build-payload와 화면이 **같은 함수**로 나누게 하려고 둔다 — 이
 * 매핑이 두 벌이 되는 순간 "화면은 ①이라는데 payload는 ②"가 다시 생긴다.
 */
export function manufacturerInputFromProduct(product: {
  manufacturer: { value: string; source: string; inputMode?: InputMode };
  manufacturerOrigin?: ManufacturerOrigin;
}): Pick<
  ManufacturerResolverInput,
  "manualManufacturer" | "sourceUrlManufacturer" | "productInfoManufacturer" | "productInputMode"
> {
  /* 🔴 PIVOT NEXT-04c — 입력 «방식» 을 여기서 잃지 않는다.
     예전에는 값이 비면 {} 를 돌려줘서, 「참조로 정했다」는 사실이 resolver 에
     도달하지 못했다. 그래서 폴백이 돌았다.

     interpretField 를 여기서 부르지 않고 «필드 모양 그대로» 읽는 이유: 이
     패키지는 shared 의 ProvenanceField 전체가 아니라 세 칸만 받는 느슨한
     구조체를 받는다(세 채널 빌더가 각자 다른 모양을 넘긴다). legacy 규칙
     자체는 아래 한 줄로 충분하다 — 나머지는 interpretField 가 맡는다. */
  const inputMode: InputMode | undefined =
    product.manufacturer.inputMode ??
    (product.manufacturer.source === "DETAIL_PAGE_REFERENCE" ? "DETAIL_REFERENCE" : undefined);

  const value = clean(product.manufacturer.value);
  if (!value) return inputMode ? { productInputMode: inputMode } : {};
  /* 셀러가 직접 고친 값(USER_EDITED)이면 ⑤. 그 외에는 크롤러가 채운 값이고,
     어디서 읽었는지는 canonical 단계가 이미 기록해 뒀다(manufacturerOrigin).
     기록이 없으면 ②로 본다 — ①("원본이 명시했다")이라고 단정할 근거가 없다. */
  if (product.manufacturer.source === "USER_EDITED") return { manualManufacturer: value };
  if (product.manufacturerOrigin === "SOURCE_URL") return { sourceUrlManufacturer: value };
  return { productInfoManufacturer: value };
}

/** 셀러가 읽는 단계 이름. 화면 세 곳이 같은 말을 쓰게 하려고 여기서 정한다. */
export const MANUFACTURER_SOURCE_LABEL: Record<ManufacturerSource, string> = {
  MANUAL: "직접 입력",
  SOURCE_URL: "원본 페이지",
  /* ①과 ②는 셀러 눈에는 둘 다 «상품 원문»이다 — 다른 이름을 붙이되, ②는 예전
     화면이 「상품 원문」이라 부르던 바로 그 자리다(문구 회귀 없음). */
  PRODUCT_INFO: "상품 원문",
  /* 「브랜드 프로필」은 설정 > 브랜드 관리 탭 안의 카드 제목이다
     (settings/page.tsx:388 탭 · 1987 카드). 값이 담긴 그릇의 이름을 쓴다. */
  BRAND_DEFAULT: "브랜드 프로필",
  SELLER_DEFAULT: "판매자 기본정보",
  /* 다른 라벨은 「값이 어디서 왔는가」인데 이것만 「어떻게 등록하는가」다.
     셀러에게는 둘 다 「이 칸이 지금 어떤 상태인가」라 같은 자리에서 읽힌다. */
  DETAIL_REFERENCE: "상세페이지 참조",
  NONE: "확인된 출처 없음",
};

/**
 * 화면이 "여기까지 찾아봤다"를 셀러가 읽는 순서 그대로 적을 때 쓰는 단계 목록.
 * 안내 문구가 세 탭에서 각자 다른 순서를 적지 않도록 여기서 한 번만 정한다.
 */
export const MANUFACTURER_LOOKUP_ORDER: ManufacturerSource[] = [
  "SOURCE_URL",
  "PRODUCT_INFO",
  "BRAND_DEFAULT",
  "SELLER_DEFAULT",
];

/** 상품 자체가 들고 있는 값으로 채워진 단계(①·②·⑤) — 화면이 "자동 적용됨"
 *  배지를 붙일지(③·④) 아니면 그냥 값만 보여줄지 가르는 데 쓴다. */
export function isProductLevelManufacturer(source: ManufacturerSource): boolean {
  return source === "MANUAL" || source === "SOURCE_URL" || source === "PRODUCT_INFO";
}
