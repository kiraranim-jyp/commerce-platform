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

export type MatchLevel = "very_high" | "high" | "medium" | "low";

export function classifyMatchLevel(confidence: number): MatchLevel {
  if (confidence >= 0.95) return "very_high";
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

export interface MatchResult {
  confidence: number;
  level: MatchLevel;
  reasons: string[];
}

/** 규칙 기반 동일상품 판별(AI 미사용). "검색으로 찾음"이 아니라 "동일상품일 가능성"을
 * 표현하는 것이 목표 — 브랜드/모델명/색상/SKU/URL slug 순으로 확인 가능한 신호만
 * 사용하고, 신호가 없으면 점수를 올리지도 내리지도 않는다(추측 금지). */
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
