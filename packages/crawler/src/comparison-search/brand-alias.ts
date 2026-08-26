/**
 * N-4.18-P-4 STEP P-4-1(대표님 지시, 2026-08-26) — 번역이 아니라, 실제 국내
 * 편집샵(RULII)에서 실측으로 동일 브랜드 후보를 반환하는 것이 확인된 한글
 * 표기만 등록한다(N-4.18-P-3 STEP P-3-3/5/6 실측 근거, 3개 브랜드 모두 원문
 * 영문 검색 0건 → 브랜드 한글 alias 검색 4~5건, 오탐 0건 확인). 새 alias
 * 추론/자동 번역/유사발음 생성 금지 — 이 목록에 없는 브랜드는 폴백을 시도하지
 * 않는다.
 *
 * 브랜드당 alias는 정확히 1개만 둔다(STEP P-4-3: 비용 통제를 데이터 구조
 * 수준에서 강제). PèPè는 "페페"/"페페슈즈" 둘 다 실측 확인됐지만, "페페"가
 * 더 많은 실제 후보(5건 vs 2건)를 반환했고 둘 다 오탐 0건이었으므로 "페페"를
 * 채택한다(STEP P-4-3 우선순위 규칙: 실측 결과가 더 안정적인 alias).
 *
 * 브랜드 문자열은 실제 CanonicalProduct.brand.value 그대로 등록한다(예:
 * Konges Sløjd 상품의 실제 brand 필드값은 "Konges Slojd Clothing"이지 표시용
 * 타이틀의 "Konges Sløjd"가 아니다 — N-4.18-P-3 STEP P-3-1 실측 확인).
 */
export interface BrandAlias {
  /** CanonicalProduct.brand.value에 실제로 등록된 원문 브랜드 문자열(정규화 비교). */
  brand: string;
  /** 국내 편집샵 검색에 쓸 한글 표기 1개(실측 확인됨). */
  alias: string;
}

const BRAND_ALIASES: BrandAlias[] = [
  { brand: "Pèpè Shoes", alias: "페페" },
  { brand: "Emile et Ida", alias: "에밀에이다" },
  { brand: "Konges Slojd Clothing", alias: "콩제슬래드" },
];

// match.ts의 normalizeText와 동일한 원리(NFKD + 결합 발음기호 제거 + 소문자) —
// "PèPè Shoes"/"pepe shoes"/"PEPE SHOES"가 전부 같은 브랜드로 조회되게 한다.
const COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;
function normalizeBrand(text: string): string {
  return text.normalize("NFKD").replace(COMBINING_DIACRITICS_RE, "").toLowerCase().trim();
}

const ALIAS_BY_NORMALIZED_BRAND = new Map(BRAND_ALIASES.map((a) => [normalizeBrand(a.brand), a.alias]));

/** 실측 등록된 브랜드가 아니면 undefined(폴백을 시도하지 않는다는 뜻). */
export function lookupBrandAlias(brand: string | undefined): string | undefined {
  if (!brand) return undefined;
  return ALIAS_BY_NORMALIZED_BRAND.get(normalizeBrand(brand));
}
