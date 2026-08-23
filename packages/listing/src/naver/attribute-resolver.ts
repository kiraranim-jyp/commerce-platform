import type { CanonicalProduct } from "@commerce/shared";
import type { ProductSignals } from "@commerce/category";

/** N-4.00 A-2(대표님 지시, N-3.87 설계 확정 후 구현) — Naver 카테고리 속성
 * (`GET /v1/product-attributes/attributes`, `/attribute-values`, 실측 확인됨)
 * 메타데이터의 최소 형태. 실제 값은 packages/listing/src/naver/attribute-metadata/
 * 아래 카테고리별 JSON 파일(N-4.00에서 category 50000535 기준 실측 저장)에서
 * 읽는다 — 이 모듈은 카테고리를 하드코딩하지 않는다. */
export interface NaverCategoryAttributeValue {
  attributeValueSeq: number;
  value: string;
}

export interface NaverCategoryAttributeMeta {
  attributeSeq: number;
  attributeName: string;
  attributeClassificationType: "SINGLE_SELECT" | "MULTI_SELECT" | "RANGE";
  /** 0이면 제한 없음(사실상 단일선택으로 취급), 1보다 크면 그 값만큼 다중선택
   * 가능(예: 주요소재=5). 공식 API 필드명(ExternalApiAttributeVo.product)을
   * 그대로 쓴다. */
  attributeValueMaxMatchingCount: number;
  values: NaverCategoryAttributeValue[];
}

export type NaverAttributeResolutionStatus = "MATCHED" | "UNRESOLVED" | "NOT_AVAILABLE";

export interface NaverAttributeResolutionResult {
  attributeSeq: number;
  attributeName: string;
  /** N-3.87 STEP4(대표님 지시) — 이 값이 어디서 왔는지 UI/로그에서 그대로
   * 보여줄 수 있어야 한다("왜 이렇게 자동입력됐는지 추적 가능"). */
  source: string | null;
  sourceValue: string | null;
  matched: { attributeValueSeq: number; value: string }[];
  status: NaverAttributeResolutionStatus;
}

export interface NaverAttributeResolution {
  /** payload의 detailAttribute.productAttributes[]에 그대로 들어가는 형태
   * (N-3.85에서 공식 스펙으로 확인된 필드 경로/형태, ExternalApiProductAttributeVo.product). */
  attributes: { attributeSeq: number; attributeValueSeq: number }[];
  results: NaverAttributeResolutionResult[];
}

/** N-3.87 STEP2(대표님 지시) — 성별. gender=unknown이면 미입력(추정 금지). */
const GENDER_VALUE_BY_SIGNAL: Record<string, string> = {
  girl: "여아용",
  boy: "남아용",
  unisex: "공용",
};

/** N-3.87 STEP2 — 타겟연령. adult는 KIDS 카테고리 허용값에 없어 자연스럽게
 * UNRESOLVED가 된다(별도 예외 처리 불필요 — 허용값 목록에 없으면 안 채운다). */
const TARGET_AGE_VALUE_BY_SIGNAL: Record<string, string> = {
  baby: "베이비",
  kids: "키즈",
  teen: "주니어",
};

/** N-3.87 STEP6(대표님 지시: "영→한 매칭은 화이트리스트 방식") — 원문 설명에서
 * 자주 등장하는 영문 소재 표기 → Naver 허용값(정확히 category attribute-values
 * 응답의 minAttributeValue와 일치해야 매칭됨) 후보. 여기 없는 표현은 절대
 * 임의로 추정하지 않는다(UNRESOLVED로 남김). 더 구체적인 문구를 먼저
 * 검사하도록 배열 순서를 유지한다(예: "faux fur"를 "fur"보다 먼저). */
const MATERIAL_KEYWORD_MAP: { pattern: RegExp; value: string }[] = [
  { pattern: /faux\s*fur|fake\s*fur/i, value: "인조퍼" },
  { pattern: /faux\s*leather|synthetic\s*leather|vegan\s*leather|pu\s*leather/i, value: "인조가죽(합성피혁)" },
  { pattern: /fox\s*fur/i, value: "폭스퍼" },
  { pattern: /raccoon\s*fur/i, value: "라쿤퍼" },
  { pattern: /rabbit\s*(fur|hair)/i, value: "토끼털" },
  { pattern: /organic\s*cotton|100%\s*cotton|cotton\s*blend|\bcotton\b/i, value: "면" },
  { pattern: /\bpolyester\b/i, value: "폴리에스테르" },
  { pattern: /\bdenim\b/i, value: "데님" },
  { pattern: /merino\s*wool|\bwool\b/i, value: "울/모" },
  { pattern: /\bnylon\b/i, value: "나일론" },
  { pattern: /\bleather\b/i, value: "가죽" },
  { pattern: /\bviscose\b/i, value: "비스코스" },
  { pattern: /\brayon\b/i, value: "레이온/인견" },
  { pattern: /\bcashmere\b/i, value: "캐시미어" },
  { pattern: /\blinen\b|\bflax\b/i, value: "마/리넨" },
  { pattern: /\bfleece\b/i, value: "기모" },
  { pattern: /\bspandex\b|\belastane\b|\blycra\b/i, value: "스판덱스" },
  { pattern: /\bacrylic\b/i, value: "아크릴" },
  { pattern: /polyurethane|\bpu\b/i, value: "폴리우레탄" },
  { pattern: /\bsilk\b/i, value: "실크" },
  { pattern: /\bmodal\b/i, value: "모달" },
  { pattern: /\btencel\b/i, value: "텐셀" },
  { pattern: /\blyocell\b/i, value: "리오셀" },
  { pattern: /\bcorduroy\b/i, value: "코듀로이" },
  { pattern: /\bchiffon\b/i, value: "시폰" },
  { pattern: /\bsuede\b/i, value: "스웨이드" },
  { pattern: /\bvelvet\b/i, value: "벨벳" },
  { pattern: /\bsatin\b/i, value: "새틴" },
  { pattern: /\bneoprene\b/i, value: "네오프렌" },
  { pattern: /\bmohair\b/i, value: "모헤어" },
  { pattern: /\balpaca\b/i, value: "알파카" },
  { pattern: /\bangora\b/i, value: "앙고라" },
  { pattern: /polyamide/i, value: "폴리아미드" },
  { pattern: /\bacetate\b/i, value: "아세테이트" },
  { pattern: /seersucker/i, value: "시어서커" },
  { pattern: /coolmax/i, value: "쿨맥스" },
  { pattern: /\bmink\b/i, value: "밍크" },
];

function findAttribute(meta: NaverCategoryAttributeMeta[], attributeName: string): NaverCategoryAttributeMeta | undefined {
  return meta.find((a) => a.attributeName === attributeName);
}

function valueByName(attr: NaverCategoryAttributeMeta | undefined, name: string) {
  return attr?.values.find((v) => v.value === name);
}

function resolveFromSignal(
  meta: NaverCategoryAttributeMeta[],
  attributeName: string,
  signalValue: string,
  signalMap: Record<string, string>,
  source: string,
): NaverAttributeResolutionResult {
  const attr = findAttribute(meta, attributeName);
  if (!attr) {
    return { attributeSeq: -1, attributeName, source: null, sourceValue: null, matched: [], status: "NOT_AVAILABLE" };
  }
  const targetName = signalMap[signalValue];
  const match = targetName ? valueByName(attr, targetName) : undefined;
  if (!match) {
    return {
      attributeSeq: attr.attributeSeq,
      attributeName,
      source,
      sourceValue: signalValue,
      matched: [],
      status: signalValue === "unknown" ? "UNRESOLVED" : "UNRESOLVED",
    };
  }
  return {
    attributeSeq: attr.attributeSeq,
    attributeName,
    source,
    sourceValue: signalValue,
    matched: [{ attributeValueSeq: match.attributeValueSeq, value: match.value }],
    status: "MATCHED",
  };
}

/** N-3.87 STEP2 — 연령. product.recommendedAge 원문에 명시된 경우에만
 * "3-6 Years" 같은 범위 표기에서 각 정수 나이를 뽑아 Naver 허용값("N세",
 * "7세이상")과 매칭한다. 원문에 없으면 추정하지 않는다(UNRESOLVED). */
function resolveAgeAttribute(
  meta: NaverCategoryAttributeMeta[],
  recommendedAge: string,
): NaverAttributeResolutionResult {
  const attributeName = "연령";
  const attr = findAttribute(meta, attributeName);
  if (!attr) {
    return { attributeSeq: -1, attributeName, source: null, sourceValue: null, matched: [], status: "NOT_AVAILABLE" };
  }
  const trimmed = recommendedAge.trim();
  if (!trimmed) {
    return { attributeSeq: attr.attributeSeq, attributeName, source: null, sourceValue: null, matched: [], status: "UNRESOLVED" };
  }
  // "3-6 Years", "3-6 years old", "3~6세" 같은 범위 표기에서 정수만 추출.
  const numbers = Array.from(trimmed.matchAll(/\d+/g)).map((m) => Number(m[0]));
  if (numbers.length === 0) {
    return { attributeSeq: attr.attributeSeq, attributeName, source: "product.recommendedAge", sourceValue: trimmed, matched: [], status: "UNRESOLVED" };
  }
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const matched: { attributeValueSeq: number; value: string }[] = [];
  for (let age = min; age <= max; age++) {
    const label = age >= 7 ? "7세이상" : `${age}세`;
    const found = valueByName(attr, label);
    if (found && !matched.some((m) => m.attributeValueSeq === found.attributeValueSeq)) {
      matched.push({ attributeValueSeq: found.attributeValueSeq, value: found.value });
    }
  }
  return {
    attributeSeq: attr.attributeSeq,
    attributeName,
    source: "product.recommendedAge",
    sourceValue: trimmed,
    matched,
    status: matched.length > 0 ? "MATCHED" : "UNRESOLVED",
  };
}

/** N-3.87 STEP2/STEP6 — 주요소재. product.material 원문(extractMaterial()이
 * 이미 뽑아둔 "88% Polyester, 12% Elastane" 같은 원문)에서 화이트리스트로
 * 매칭되는 것만 채운다(최대 5개, attributeValueMaxMatchingCount 준수). */
function resolveMaterialAttribute(
  meta: NaverCategoryAttributeMeta[],
  materialRaw: string,
): NaverAttributeResolutionResult {
  const attributeName = "주요소재";
  const attr = findAttribute(meta, attributeName);
  if (!attr) {
    return { attributeSeq: -1, attributeName, source: null, sourceValue: null, matched: [], status: "NOT_AVAILABLE" };
  }
  const trimmed = materialRaw.trim();
  if (!trimmed) {
    return { attributeSeq: attr.attributeSeq, attributeName, source: null, sourceValue: null, matched: [], status: "UNRESOLVED" };
  }
  const maxCount = attr.attributeValueMaxMatchingCount > 0 ? attr.attributeValueMaxMatchingCount : 1;
  const matched: { attributeValueSeq: number; value: string }[] = [];
  for (const { pattern, value } of MATERIAL_KEYWORD_MAP) {
    if (matched.length >= maxCount) break;
    if (!pattern.test(trimmed)) continue;
    const found = valueByName(attr, value);
    if (found && !matched.some((m) => m.attributeValueSeq === found.attributeValueSeq)) {
      matched.push({ attributeValueSeq: found.attributeValueSeq, value: found.value });
    }
  }
  return {
    attributeSeq: attr.attributeSeq,
    attributeName,
    source: "product.material",
    sourceValue: trimmed,
    matched,
    status: matched.length > 0 ? "MATCHED" : "UNRESOLVED",
  };
}

/** N-3.87/N-4.00 A-2 — CanonicalProduct → Naver 카테고리 속성 매핑.
 * 카테고리를 하드코딩하지 않는다 — categoryAttributes(실제 GET 메타데이터,
 * 카테고리마다 다름)에 있는 속성만 순회하고, 그 카테고리에 없는 속성은
 * NOT_AVAILABLE로 명시한다. 성별/타겟연령/연령/주요소재 외의 속성(소매기장/
 * 패턴/네크라인/총기장/핏/안감)은 대응하는 CanonicalProduct 필드 자체가
 * 없어 이번 구현 범위에 넣지 않는다(추출 로직이 없는데 매칭만 만들면 항상
 * UNRESOLVED만 나오는 죽은 코드라 — 필드가 생기면 그때 추가한다). */
export function resolveNaverProductAttributes(
  product: Pick<CanonicalProduct, "material" | "recommendedAge">,
  signals: ProductSignals,
  categoryAttributes: NaverCategoryAttributeMeta[],
): NaverAttributeResolution {
  const results: NaverAttributeResolutionResult[] = [
    resolveFromSignal(categoryAttributes, "성별", signals.gender, GENDER_VALUE_BY_SIGNAL, "resolveProductSignals().gender"),
    resolveFromSignal(
      categoryAttributes,
      "타켓연령",
      signals.ageGroup,
      TARGET_AGE_VALUE_BY_SIGNAL,
      "resolveProductSignals().ageGroup",
    ),
    resolveAgeAttribute(categoryAttributes, product.recommendedAge.value),
    resolveMaterialAttribute(categoryAttributes, product.material.value),
  ];

  const attributes = results
    .filter((r) => r.status === "MATCHED")
    .flatMap((r) => r.matched.map((m) => ({ attributeSeq: r.attributeSeq, attributeValueSeq: m.attributeValueSeq })));

  return { attributes, results };
}
