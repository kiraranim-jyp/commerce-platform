/**
 * REWORK-10 A(CEO 지시, 2026-09-15) — **제조사는 전 채널 공통 resolver 하나다.**
 *
 * ── 왜 이 파일이 생겼나 ──────────────────────────────────────────────────
 * 폴백 사슬 자체는 세 채널에 이미 다 있었다. 그런데 **세 벌이었다**:
 *
 *   쿠팡    coupang/build-payload.ts
 *           `product.manufacturer.value || brandProfile?.manufacturer || sellerConfig.manufacturer`
 *   네이버  naver/build-payload.ts + api/naver/_lib/resolve-context.ts
 *           `product.manufacturer.value.trim() || resolvedManufacturer`
 *           (resolvedManufacturer = `brandProfile?.manufacturer || sellerProfile?.manufacturer`)
 *   롯데ON  lotteon/build-payload.ts
 *           `product.manufacturer.value.trim()` — **폴백이 아예 없었다**
 *
 * 그리고 **화면은 그중 하나(네이버)의 결과만 받았다.** CommerceWorkspace가
 * `naverResolved`를 `tab === "smartstore"`일 때만 내려보내서, 쿠팡 탭은
 * 브랜드 프로필이 제조사를 채워 주는데도 화면에는 "⚠ 제조사 정보가 없습니다"가
 * 남았다(CEO 실측). 롯데ON 탭은 그 사실을 말하는 자리조차 없었다.
 *
 * ── 이 파일이 하는 일 ────────────────────────────────────────────────────
 * 네 단계를 **한 곳에서** 정한다. 새 규칙이 아니라 쿠팡이 이미 쓰던 그 순서다:
 *
 *   ① PRODUCT         상품 원문 제조사(크롤러/셀러가 상품에 직접 넣은 값)
 *   ② BRAND_DEFAULT   브랜드 프로필의 제조사
 *   ③ SELLER_DEFAULT  판매자 기본정보의 제조사
 *   ④ NONE            셋 다 없음 — 직접 입력하거나 등록할 수 없다
 *
 * 🔴 값을 지어내지 않는다. ④는 "빈 문자열"이 아니라 **판정**이다 — 화면은 이
 * 판정을 보고 "어디까지 찾아봤는지"를 말할 수 있어야 한다.
 *
 * ── 🔴 쿠팡 payload는 이 파일을 import하지 않는다 ────────────────────────
 * 쿠팡 등록 경로는 지금 유일하게 실증된 성공 경로라 이번 작업에서 diff 0으로
 * 유지한다(CEO 금지 항목). 대신 아래 `resolveManufacturer()`가 쿠팡의 `||`
 * 사슬과 **문자 그대로 같은 결과**를 낸다는 것을 테스트가 고정한다
 * (__tests__/manufacturer-resolver.test.ts — 쿠팡 build-payload를 실제로
 * 호출해서 이 함수의 결과와 대조한다).
 */

/** 제조사를 채운 단계. 화면이 "어디서 온 값인가"를 말할 때 쓰는 유일한 축이다. */
export type ManufacturerSource = "PRODUCT" | "BRAND_DEFAULT" | "SELLER_DEFAULT" | "NONE";

export interface ManufacturerResolution {
  /** 실제로 payload에 들어갈 값. NONE이면 빈 문자열이다(지어낸 값이 아니다). */
  value: string;
  source: ManufacturerSource;
  /** 값을 찾았는가. `source !== "NONE"`과 같은 뜻 — 호출부의 조건문을 짧게 하려고 둔다. */
  resolved: boolean;
}

export interface ManufacturerResolverInput {
  /** ① 상품 원문 제조사(CanonicalProduct.manufacturer.value). */
  productManufacturer?: string | null;
  /** ② 브랜드 프로필의 제조사(BrandProfile.manufacturer). */
  brandProfileManufacturer?: string | null;
  /** ③ 판매자 기본정보의 제조사(SellerProfile.manufacturer). */
  sellerProfileManufacturer?: string | null;
}

/**
 * 전 채널 공통 제조사 resolver. 순수함수 — DB도 네트워크도 모른다(값을 조회해
 * 오는 것은 호출부의 책임이다. build-payload.ts들이 brandProfile을 인자로
 * 받는 것과 같은 규칙).
 */
export function resolveManufacturer(input: ManufacturerResolverInput): ManufacturerResolution {
  const product = (input.productManufacturer ?? "").trim();
  if (product) return { value: product, source: "PRODUCT", resolved: true };

  const brand = (input.brandProfileManufacturer ?? "").trim();
  if (brand) return { value: brand, source: "BRAND_DEFAULT", resolved: true };

  const seller = (input.sellerProfileManufacturer ?? "").trim();
  if (seller) return { value: seller, source: "SELLER_DEFAULT", resolved: true };

  return { value: "", source: "NONE", resolved: false };
}

/** 셀러가 읽는 단계 이름. 화면 세 곳이 같은 말을 쓰게 하려고 여기서 정한다. */
export const MANUFACTURER_SOURCE_LABEL: Record<ManufacturerSource, string> = {
  PRODUCT: "상품 원문",
  BRAND_DEFAULT: "브랜드 프로필",
  SELLER_DEFAULT: "판매자 기본정보",
  NONE: "확인된 출처 없음",
};
