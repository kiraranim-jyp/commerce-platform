/**
 * N-4.04 Part C/U(대표님 지시) — "현재 Payload의 모든 필드를 COMMON/MAPPED/
 * SMARTSTORE_ONLY/COUPANG_ONLY로 분류"하고, 이걸 그대로 Readiness Engine과
 * 공유하는 Marketplace Capability Matrix의 단일 소스로 쓴다.
 *
 * 이 파일의 각 행은 실제 코드(packages/listing/src/naver/build-payload.ts,
 * packages/listing/src/coupang/build-payload.ts)를 직접 읽고 검증한 결과다 —
 * 추정으로 채우지 않았다. 특히 두 곳은 대표님이 예시로 든 분류와 실제 코드가
 * 다르다는 걸 확인했다:
 *   - KC(인증정보): 대표님 예시는 MAPPED였지만, 실제로 Coupang 빌더는 KC를
 *     의도적으로 payload에서 제외한다(build-payload.ts 주석: "판매자가 직접
 *     입력해야 하는 항목이라 자동 매핑하지 않는다") — 그래서 SMARTSTORE_ONLY다.
 *   - 상품속성: 대표님 예시는 SMARTSTORE_ONLY였지만, 실제로 Coupang도
 *     buildCoupangCompliance()로 attributes[]/notices[]를 만든다 — 구조는
 *     다르지만(SmartStore는 attributeSeq/attributeValueSeq, Coupang은 느슨한
 *     동의어 매칭) 둘 다 존재하므로 MAPPED다.
 * 두 정정 모두 코드에서 실제로 확인한 사실이며, 예시와 다르다고 코드를
 * 예시에 맞추지 않았다(추정 금지 원칙과 같은 이유).
 */
export type FieldOwnership = "COMMON" | "MAPPED" | "SMARTSTORE_ONLY" | "COUPANG_ONLY";

/** Part U — 마켓플레이스별 지원 수준. SOON은 elevenst/esm 전용(실제 API 미연동).
 * NOT_APPLICABLE은 "나중에 지원 예정"이 아니라 "이 마켓 개념 자체에 해당
 * 필드가 없다"는 뜻 — SOON과 구분해야 오해가 없다(예: 네이버쇼핑 검색정보는
 * Coupang에 대응 개념 자체가 없다, 나중에 생길 수도 없다). */
export type CapabilityLevel = "SUPPORTED" | "PARTIAL" | "NOT_APPLICABLE" | "SOON";

export interface FieldCapabilityRow {
  field: string;
  label: string;
  ownership: FieldOwnership;
  smartstore: CapabilityLevel;
  coupang: CapabilityLevel;
  elevenst: CapabilityLevel;
  esm: CapabilityLevel;
  /** 왜 이 등급인지 — 특히 PARTIAL/SOON은 반드시 이유를 남긴다(추측 금지 원칙). */
  note: string;
}

export const FIELD_CAPABILITY_MATRIX: FieldCapabilityRow[] = [
  {
    field: "title",
    label: "상품명",
    ownership: "COMMON",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "둘 다 CanonicalProduct.title 기반. SmartStore는 SEO 최적화 생성명, Coupang은 원문 그대로.",
  },
  {
    field: "brand",
    label: "브랜드",
    ownership: "COMMON",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "둘 다 CanonicalProduct.brand(+Brand Resolver 정제) 기반.",
  },
  {
    field: "manufacturer",
    label: "제조사",
    ownership: "COMMON",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "둘 다 상품추출 > 브랜드기본값 > Seller기본값 3단계 우선순위 동일.",
  },
  {
    field: "price",
    label: "가격",
    ownership: "COMMON",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "둘 다 packages/pricing computePriceBreakdown 결과(priceKrw)를 그대로 사용.",
  },
  {
    field: "stock",
    label: "재고",
    ownership: "COMMON",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "둘 다 product.stockQuantity(또는 variant별 재고) 기반.",
  },
  {
    field: "options",
    label: "옵션",
    ownership: "MAPPED",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "SmartStore는 optionCombinations(조합형), Coupang은 items[](variant당 1개) — 구조가 다르다.",
  },
  {
    field: "origin",
    label: "원산지",
    ownership: "MAPPED",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "SmartStore는 originAreaCode 구조화 값, Coupang은 attributes/notices 느슨한 동의어 매칭.",
  },
  {
    field: "material",
    label: "소재",
    ownership: "MAPPED",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "SmartStore는 productInfoProvidedNotice 구조화 필드, Coupang은 attributes/notices 매칭.",
  },
  {
    field: "attributes",
    label: "상품속성",
    ownership: "MAPPED",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "SmartStore는 attributeSeq/attributeValueSeq, Coupang은 attributes[]+notices[] 느슨한 매칭(둘 다 실제 payload에 포함).",
  },
  {
    field: "kc",
    label: "KC 인증",
    ownership: "SMARTSTORE_ONLY",
    smartstore: "SUPPORTED",
    coupang: "PARTIAL",
    elevenst: "SOON",
    esm: "SOON",
    note: "Coupang 빌더는 KC를 payload에서 의도적으로 제외한다(판매자가 Wing에서 직접 입력) — 자동 매핑 없음.",
  },
  {
    field: "delivery",
    label: "배송",
    ownership: "MAPPED",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "SmartStore는 deliveryInfo 구조, Coupang은 deliveryMethod/deliveryCompanyCode 구조 — 필드명이 다르다.",
  },
  {
    field: "naverShopping",
    label: "네이버쇼핑 검색정보",
    ownership: "SMARTSTORE_ONLY",
    smartstore: "SUPPORTED",
    coupang: "NOT_APPLICABLE",
    elevenst: "SOON",
    esm: "SOON",
    note: "naverShoppingSearchInfo(modelName/brandName)는 SmartStore 전용 — Coupang엔 대응 개념 자체가 없다.",
  },
  {
    field: "registration",
    label: "등록(실제 API 호출)",
    ownership: "MAPPED",
    smartstore: "SUPPORTED",
    coupang: "SUPPORTED",
    elevenst: "SOON",
    esm: "SOON",
    note: "SmartStore/Coupang 모두 register executor 존재. 11번가/ESM은 register()가 항상 NOT_IMPLEMENTED.",
  },
];
