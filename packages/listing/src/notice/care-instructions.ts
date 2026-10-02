import type { ProvenanceField } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CARE-LABEL-REFERENCE (CPO 확정 문구, 2026-10-01)
 * **세탁방법·취급주의가 원본에 없을 때의 기본값.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 셀러가 상품마다 세탁방법을 손으로 적는 일을 없애는 것이 목적이다.
 *
 * ── 🔴 왜 「상품 상세페이지 참조」를 쓰지 «않는가» ────────────────────────
 * 세탁정보는 상세페이지가 아니라 **옷에 달린 케어라벨**에 있다. 상세페이지에
 * 세탁정보가 없는데 「상세페이지 참조」라고 적으면 그것은 거짓이고, 구매자가
 * 상세페이지를 뒤져도 찾지 못한다. 그래서 «다른 문구» 를 쓴다.
 *
 * 🔴 두 문구를 «혼용하지 않는다»:
 *     DETAIL_PAGE_REFERENCE_TEXT  "상품 상세페이지 참조"  ← 셀러가 «고르는» 것
 *     CARE_LABEL_REFERENCE_TEXT   "케어라벨 참조"         ← 원본이 없을 때 «기본값»
 * 전자는 `source: "DETAIL_PAGE_REFERENCE"` 로 표시되는 셀러의 선택이고,
 * 후자는 `source: "DEFAULT"` 로 표시되는 우리가 넣은 값이다. provenance 가
 * 둘을 구분하므로 화면도 「셀러가 고름」과 「기본값」을 갈라 말할 수 있다.
 *
 * ── 우선순위 (CPO 확정) ───────────────────────────────────────────────────
 *     원본에 세탁정보 있음   → 원본 그대로 (source: ORIGINAL)
 *     원본에 없음            → "케어라벨 참조" (source: DEFAULT)
 *     셀러가 입력/선택함     → 🔴 절대 덮지 않는다
 *
 * 🔴 payload 에 문자열을 «박아 넣지» 않는다. 이 함수는 `CanonicalProduct` 의
 * 필드 하나를 만들고, 그 뒤는 기존 경로(resolveNoticeFieldValue →
 * 네이버 caution · 롯데ON 0050/0800 · 쿠팡)가 그대로 처리한다. 채널마다 따로
 * 넣으면 세 곳이 갈라진다.
 */
export const CARE_LABEL_REFERENCE_TEXT = "케어라벨 참조";

/** 이 값이 우리가 넣은 기본값인가 — 화면이 「기본값입니다」라고 말할 때 쓴다. */
export function isCareLabelReferenceDefault(field: ProvenanceField<string> | undefined): boolean {
  return field?.source === "DEFAULT" && field.value === CARE_LABEL_REFERENCE_TEXT;
}

/**
 * 수집 직후 `careInstructions` 를 정한다.
 *
 * 🔴 **빈 자리에만** 기본값을 넣는다. 이미 값이 있으면(원본이든 셀러 입력이든)
 * 그대로 돌려준다 — 참조 선택(`source: "DETAIL_PAGE_REFERENCE"`)도 건드리지
 * 않는다. 그래야 ②(전체 참조 적용)와 충돌하지 않는다.
 *
 * @param extracted 원본에서 뽑은 세탁/취급 문구. 없으면 null/undefined/"".
 */
export function resolveCareInstructions(extracted: string | null | undefined): ProvenanceField<string> {
  const value = (extracted ?? "").trim();
  if (value) return { value, source: "ORIGINAL", confidence: 0.7 };
  /* 🔴 confidence 를 1 로 올리지 않는다 — 우리가 「라벨을 보라」고 말하는 것일
     뿐이고 세탁방법을 «안다» 는 뜻이 아니다. */
  return { value: CARE_LABEL_REFERENCE_TEXT, source: "DEFAULT", confidence: 0 };
}

/**
 * 이미 만들어진 필드에 기본값을 적용한다(수집 이후 경로용).
 * 🔴 값이 있으면 **그 객체를 그대로** 돌려준다 — 새 객체를 만들지 않으므로
 * 호출부가 「바뀌었는지」를 참조 비교로 알 수 있다.
 */
export function withCareLabelDefault(field: ProvenanceField<string> | undefined): ProvenanceField<string> {
  if (field && field.value.trim() !== "") return field;
  if (field?.source === "DETAIL_PAGE_REFERENCE") return field;
  return resolveCareInstructions(null);
}
