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
  /**
   * 🔴🔴 WU-151 — **실측 1건 등록**(무차별 음역 확장이 아니다 · 이 파일의 규칙 그대로).
   *
   * 실측(2026-10-22 · B226AC009):
   * ```
   * beaumonde.co.kr  og:title 「**보보쇼즈** 26FW 아동 긴팔 티셔츠 … B226AC009」
   *                  본문 「보보쇼즈」 **27회** · 「Bobo Choses」 **3회**
   * 원상품/해외      bobochoses.com · junioredition.com → brand 「Bobo Choses」
   * ```
   * 🔴 브랜드 문자열은 **`CanonicalProduct.brand.value` 그대로** 등록한다(이 파일 규칙).
   *    원상품 추출 실측값이 `"Bobo Choses"` 다(WU-134 가 복구한 그 값).
   * 🔴 브랜드당 alias **1개** — 「보보초스」 같은 다른 표기는 **실측 전까지 넣지 않는다**.
   */
  { brand: "Bobo Choses", alias: "보보쇼즈" },
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

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-151 — **역방향 조회: 상품명이 말하는 표기 → 정규 브랜드명**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 필요한가**(실측) — 국내 판매처는 브랜드를 **한글 표기로 상품명에만** 적는다.
 * ```
 * beaumonde  og:brand ❌ · product:brand ❌ · JSON-LD brand ❌
 *            og:title 「**보보쇼즈** 26FW 아동 긴팔 티셔츠 … B226AC009」 ✅
 * ⟹ 후보 facts.brand = null ⟹ MI `BRAND_UNCONFIRMED` ⟹ 품번이 맞아도 **보류**
 * ```
 * 🟢 그래서 **없는 것을 지어내지 않고, 있는 것을 읽는다**(`brandFromHtml` 주석과 같은 원칙).
 *
 * ── 🔴 CPO 가 글자로 금지한 것을 이 함수가 지키는 방식 ────────────────────────
 * ```
 * ❌ 「브랜드 문자열 substring 만으로 확정」
 *    🟢 **등록부에 실측으로 올라온 표기만** 인식한다(사전을 추론으로 늘리지 않는다).
 *    🟢 그리고 **경계를 요구** 한다 — 표기 바로 뒤/앞에 글자가 이어지면 **거부** 한다
 *       (「보보쇼즈st」·「보보쇼즈풍」 같은 유사품 표기를 브랜드로 읽지 않는다).
 * ❌ 「무차별 한글 음역」  🟢 등록부는 **브랜드당 1개** 이고 실측 근거가 주석에 있다.
 * ❌ 「사이트 전용 예외」  🟢 이 함수는 **도메인을 보지 않는다** — 국내/해외 공통이다.
 * ```
 * 🔴 **상품명만** 넘긴다(호출부 책임) — 페이지 본문 전체를 넘기면 「추천 브랜드」
 *    같은 주변 콘텐츠를 상품 브랜드로 오인한다(CPO STEP 3 의 그 금지).
 */
const ALIAS_ENTRIES = BRAND_ALIASES.map((a) => ({ brand: a.brand, alias: a.alias.trim() })).filter(
  (a) => a.alias.length > 0,
);

/** 표기 앞뒤가 «글자» 면 다른 낱말의 일부다 — 브랜드로 읽지 않는다. */
const WORDISH_RE = /[\p{L}\p{N}]/u;

export function lookupBrandByAliasInTitle(title: string | null | undefined): string | undefined {
  if (!title) return undefined;
  const text = title.normalize("NFKC");
  for (const { brand, alias } of ALIAS_ENTRIES) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(alias, from);
      if (at < 0) break;
      const before = at > 0 ? text[at - 1] : "";
      const after = text[at + alias.length] ?? "";
      /** 🔴 경계 검사 — 둘 다 「글자가 아님」이어야 채택한다. */
      if (!WORDISH_RE.test(before) && !WORDISH_RE.test(after)) return brand;
      from = at + alias.length;
    }
  }
  return undefined;
}
