import type { ComparisonCandidate, ComparisonQuery } from "./types";

const STOPWORDS = new Set(["the", "a", "an", "for", "and", "with", "by", "in", "of"]);

/** 발음기호(é/è/ê 등)를 제거하고 소문자로 통일한다 — "PèPè"/"Pepe"/"PEPE"가 전부
 * 같은 문자열로 비교되도록 한다. 이게 없으면 기존 정규식 토크나이저가 억양부호를
 * "분리 문자"로 취급해서 "pèpè"(NFC, è가 단일 코드포인트)는 "p"/"p"(둘 다 1글자라
 * 필터링됨)로, "pèpè"(NFD, e+결합 억양부호)는 "pe"/"pe"로 쪼개져 — 같은 브랜드인데
 * 유니코드 정규화 형태에 따라 토큰화 결과가 달라지는 버그가 있었다(60% confidence 원인). */
const COMBINING_DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICS_RE, "")
    .toLowerCase()
    .trim();
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(/[^a-z0-9가-힣]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 제목에서 브랜드로 추정되는 단어를 제거한다 — 브랜드 일치는 별도 신호(brandSignal)로
 * 이미 반영하므로, 모델명 비교에서 브랜드 단어가 중복으로 union을 부풀리지 않게 한다. */
function stripBrandWords(text: string, brand: string | undefined): string {
  if (!brand) return text;
  const brandNorm = normalizeText(brand);
  if (!brandNorm) return text;
  const pattern = brandNorm.split(/\s+/).filter(Boolean).join("\\s+");
  if (!pattern) return text;
  return text.replace(new RegExp(pattern, "gi"), " ");
}

/** "{모델명} in {색상} by {브랜드}" 형태(Junior Edition 등)에서 모델명/색상을 분리한다.
 * 패턴이 없으면(예: Childrensalon처럼 다른 제목 형식) 전체 텍스트를 모델명으로,
 * 색상은 "정보 없음"으로 돌려준다 — 추론하지 않는다. */
function splitModelColor(title: string): { model: string; color: string | null } {
  const byMatch = /\bby\b/i.exec(title);
  const withoutBrandSuffix = byMatch ? title.slice(0, byMatch.index) : title;
  const inMatch = /\bin\b/i.exec(withoutBrandSuffix);
  if (inMatch) {
    const model = withoutBrandSuffix.slice(0, inMatch.index).trim();
    const color = withoutBrandSuffix.slice(inMatch.index + inMatch[0].length).trim();
    if (model && color) return { model, color };
  }
  return { model: withoutBrandSuffix.trim(), color: null };
}

/** URL의 마지막 경로 세그먼트("슬러그")를 뽑는다 — Shopify(`/products/handle`)와
 * Childrensalon(`/{slug}.html`) 둘 다 이 방식으로 동작한다. */
function extractSlug(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? normalizeText(last.replace(/\.html$/i, "")) : null;
  } catch {
    return null;
  }
}

function brandsMatch(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * N-4.18-I STEP I-1(대표님 지시, 2026-08-25) — 실측 결과: RULII/LOOXLOO/DEUXBEBE
 * 3곳 모두 실제 breadcrumb/category 마크업이 존재는 하지만("xans-product-
 * headcategory", 실측 확인) 값 자체가 상품유형(PANTS/TOP 등)이 아니라
 * 프로모션성/브랜드성 분류였다 — 실측 예: RULII는 breadcrumb 자체가 없음(메뉴만
 * 있고 링크가 비어있음), LOOXLOO는 "아울렛"(할인전용관)/"래핑차일드"(브랜드
 * 하위계열), DEUXBEBE는 "Brand > karisako 카리사코"(브랜드 트리). 이 값들을
 * "카테고리 신호"로 쓰면 브랜드 신호와 중복되거나(같은 정보를 두 번 세는 꼴) 완전히
 * 무관한 프로모션 구획을 "카테고리 불일치"로 오판하게 된다 — 대표님이 금지한
 * "추측 기반 신호"가 되어버린다.
 *
 * 대신 실제 관측된 제목 텍스트에 등장하는 상품유형 단어(대표님이 STEP I-3에서
 * 직접 예시로 준 pants/trousers/바지/팬츠/shirt/shirts/셔츠/blouse, + 이번
 * 실측에서 RULII/LOOXLOO/DEUXBEBE 실제 제목에 그대로 등장한 단어: "청바지"(RULII
 * AE099), "원피스"(LOOXLOO 다수), "셔츠"(DEUXBEBE "로히트 셔츠"))만으로 최소
 * taxonomy를 만든다 — breadcrumb가 아니라 상품명 자체에 실제로 쓰인 단어이므로
 * 추측이 아니다. 매핑에 없는 단어는 전부 null(정보 없음) — 감점하지 않는다. */
export type CategoryTaxon = "TOP" | "PANTS" | "DRESS";

const CATEGORY_TAXON_WORDS: Record<CategoryTaxon, string[]> = {
  TOP: ["shirt", "shirts", "blouse", "티셔츠", "셔츠"],
  PANTS: ["pants", "trousers", "jeans", "바지", "팬츠", "청바지"],
  DRESS: ["dress", "원피스"],
};

/** 제목 텍스트에서 상품유형 단어를 찾는다 — 정규화(normalizeText)한 문자열에
 * 단어가 부분 포함되는지만 본다(형태소 분석 없음, 실제 관측 단어와의 단순
 * 매칭). 여러 taxon 단어가 동시에 매칭되면(드묾) 첫 번째로 찾은 것을 쓴다 —
 * 완벽한 분류기가 아니라 "명백히 다른 상품유형"을 걸러내는 보조 신호이므로
 * 이 정도 단순함이 목표에 맞다. */
export function extractCategoryTaxon(text: string): CategoryTaxon | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  for (const [taxon, words] of Object.entries(CATEGORY_TAXON_WORDS) as [CategoryTaxon, string[]][]) {
    if (words.some((w) => normalized.includes(w))) return taxon;
  }
  return null;
}

export type MatchLevel = "very_high" | "high" | "medium" | "low";

/** N-4.18-D(대표님 지시, 2026-08-25: "95% 이상만 동일상품 확정, 85~94%는 유사상품으로
 * 별도 표시, 70~84%는 참고용, 70% 미만은 버린다") — 이전 경계(95/80/60)를 대표님이
 * 확정한 정확한 경계(95/85/70)로 교체한다. 이 경계는 domestic-product-link.ts의
 * toDomesticMatchType()이 그대로 이어받아 EXACT(자동 가격반영)/HIGH_CONFIDENCE(후보
 * 표시, 가격 미반영)/REVIEW_REQUIRED(참고용 표시, 가격 미반영)/NOT_MATCHED(버림)로
 * 매핑한다 — 전역 임계값이므로 두 곳에서 따로 정의하지 않고 이 함수 하나만 바꾼다. */
export function classifyMatchLevel(confidence: number): MatchLevel {
  if (confidence >= 0.95) return "very_high";
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

export interface MatchResult {
  confidence: number;
  level: MatchLevel;
  reasons: string[];
}

/** 규칙 기반 동일상품 판별(AI 미사용). "검색으로 찾음"이 아니라 "동일상품일 가능성"을
 * 표현하는 것이 목표 — 브랜드/모델명/색상/SKU/URL slug 순으로 확인 가능한 신호만
 * 사용하고, 신호가 없으면 점수를 올리지도 내리지도 않는다(추측 금지).
 *
 * N-3.11 Part C-2 — CPO가 요구한 우선순위(GTIN/EAN/UPC → SKU/ProductID → 브랜드+
 * 정확한 상품명 → 브랜드+모델명 → 이미지/상품명 보조)와 이 함수의 대응 관계:
 * GTIN/EAN/UPC는 현재 comparison_shops/ComparisonCandidate 어디에도 그런 필드가
 * 없어(추출한 적도 없음) 사용할 수 없다 — 억지로 필드를 만들지 않고 BLOCKED로
 * 보고한다. 그다음 순위인 SKU는 이미 최우선 신호로 반영돼 있다(아래 2번, 일치 시
 * 0.97 강제). 브랜드+모델명은 모델명 Jaccard(기본 점수)에 브랜드 게이트(4번,
 * 최종 승수)를 곱하는 구조로 이미 결합돼 있다. */
export function scoreCandidateMatch(query: ComparisonQuery, candidate: ComparisonCandidate): MatchResult {
  const reasons: string[] = [];
  const candidateBrandGuess = candidate.brand;
  const brandForStrip = query.brand ?? candidateBrandGuess;

  const { model: queryModel, color: queryColor } = splitModelColor(query.title);
  const { model: candidateModel, color: candidateColor } = splitModelColor(candidate.title);

  const modelScore = jaccard(
    tokenize(stripBrandWords(queryModel, brandForStrip)),
    tokenize(stripBrandWords(candidateModel, brandForStrip)),
  );
  let score = modelScore;
  reasons.push(`모델명 유사도 ${Math.round(modelScore * 100)}%`);

  // 1. 색상 — 둘 다 명시적으로 확인된 경우만 사용(추측 금지)
  if (queryColor && candidateColor) {
    if (normalizeText(queryColor) === normalizeText(candidateColor)) {
      score = score + (1 - score) * 0.4;
      reasons.push("색상 일치");
    } else {
      score = score * 0.65;
      reasons.push("색상 불일치");
    }
  }

  // N-4.18-I STEP I-4/I-6(대표님 지시: "카테고리는 강력한 보조 검증 신호로 쓴다,
  // SKU/모델보다 우선하면 안 된다") — SKU 신호(다음 단계, Math.max로 최종 override
  // 가능)보다 먼저 적용해 "SKU가 실제로 일치하면 카테고리 감점을 다시 끌어올릴 수
  // 있게" 순서를 둔다(대표님이 "품번이 같은데 카테고리가 다른 특수 상황은 별도
  // 검토 대상"이라고 명시한 것과 일치 — 여기서 억지로 해결하지 않고 SKU가 최종
  // 우선하도록만 순서를 잡는다). 둘 다 taxon이 확인될 때만 적용 — 한쪽이라도
  // 모르면(taxon=null) UNKNOWN이지 MISMATCH가 아니므로 감점하지 않는다.
  const queryTaxon = extractCategoryTaxon(query.title);
  const candidateTaxon = extractCategoryTaxon(candidate.title);
  if (queryTaxon && candidateTaxon) {
    if (queryTaxon === candidateTaxon) {
      // "의류 vs 의류"류 약한 보조 신호(대표님 예시) — 이미 확보된 점수를 크게
      // 흔들지 않을 정도로만 소폭 보정한다.
      score = score + (1 - score) * 0.1;
      reasons.push("카테고리 일치");
    } else {
      // "상의 vs 바지"류 강한 감점(대표님 예시 Case C).
      score = score * 0.3;
      reasons.push("카테고리 불일치");
    }
  }

  // 2. SKU/article code — 둘 다 있을 때만, 가장 강한 신호
  if (query.sku && candidate.sku) {
    if (normalizeText(query.sku) === normalizeText(candidate.sku)) {
      score = Math.max(score, 0.97);
      reasons.push("SKU 일치");
    } else {
      score = score * 0.3;
      reasons.push("SKU 불일치");
    }
  }

  // 3. URL slug — 완전히 같을 때만 보조 신호(다르다고 감점하지 않음, 사이트 간 slug는
  // 원래 다를 수 있음)
  if (query.sourceUrl) {
    const querySlug = extractSlug(query.sourceUrl);
    const candidateSlug = extractSlug(candidate.url);
    if (querySlug && candidateSlug && querySlug === candidateSlug) {
      score = Math.max(score, 0.95);
      reasons.push("URL slug 일치");
    }
  }

  // 4. 브랜드 — 마지막에 최종 게이트로 적용한다(다른 신호가 이미 올려둔 점수를
  // "확실히 다른 브랜드"라는 강한 반증이 다시 깎을 수 있어야 하기 때문에 순서가
  // 중요하다 — 앞에 두면 색상/SKU 보너스가 브랜드 불일치 페널티를 덮어써버린다).
  // candidate.brand가 명시적으로 있으면 신뢰도 높은 신호, 없으면 title 부분일치로만
  // "일치"를 확인하고 "불일치"는 판단하지 않는다(오탐 방지 — 모르는 걸 다르다고 단정하지 않음).
  if (query.brand) {
    if (candidateBrandGuess) {
      if (brandsMatch(query.brand, candidateBrandGuess)) {
        score = score + (1 - score) * 0.3;
        reasons.push("브랜드 일치");
      } else {
        score = score * 0.2;
        reasons.push("브랜드 불일치");
      }
    } else if (brandsMatch(query.brand, candidate.title)) {
      score = score + (1 - score) * 0.3;
      reasons.push("브랜드 일치(제목 내 확인)");
    }
  }

  const confidence = Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
  return { confidence, level: classifyMatchLevel(confidence), reasons };
}

/** 하위호환용 — 숫자 confidence만 필요한 호출부를 위해 유지. */
export function scoreCandidate(query: ComparisonQuery, candidate: ComparisonCandidate): number {
  return scoreCandidateMatch(query, candidate).confidence;
}

export function withConfidence(query: ComparisonQuery, candidates: ComparisonCandidate[]): ComparisonCandidate[] {
  return candidates
    .map((c) => {
      const { confidence, level, reasons } = scoreCandidateMatch(query, c);
      return { ...c, confidence, matchLevel: level, matchReasons: reasons };
    })
    .sort((a, b) => b.confidence - a.confidence);
}
