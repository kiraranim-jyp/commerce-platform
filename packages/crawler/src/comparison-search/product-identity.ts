/**
 * P-11 STEP 4(대표님/CPO 지시, 2026-08-30) — 해외 가격비교(comparison-search)에서
 * "동일상품 90%"류 오판정(Ezra가 Bruno와 다른 상품인데 confidence만으로 동일상품
 * 취급됨)을 고치기 위한 별도 판정 계층. match.ts의 scoreCandidateMatch()/
 * classifyMatchLevel()/confidence 계산식은 전혀 건드리지 않는다 — confidence는
 * 계속 "얼마나 비슷한가"만 말하고, 이 파일이 "같은 상품이라고 확인할 수
 * 있는가"를 별도로 판정해서 얹는다(P-10의 MatchTruth와 같은 계층 분리 패턴).
 *
 * STEP 1/2 실측(Junior Edition PèPè 카탈로그 17건 전수조사)에서 SKU를
 * 하이픈/슬래시로 쪼개 "첫 세그먼트=모델"로 해석하는 방식은 폐기했다 —
 * Sandy(TWO/BK34-VIT)와 Two Con Me(TWO/BK38-VAC, TWO/BK40-VAC)가 서로 다른
 * 상품인데 "TWO"를 공유해서 그 규칙으로는 오판정났다(실측 확인). 대신:
 * - 구조화 코드(Article code/SKU)는 "완전 일치"만 강한 증거로 쓴다(부분/세그먼트
 *   해석을 전혀 하지 않는다).
 * - "같은 모델, 다른 옵션" 판정은 title의 모델명 부분(match.ts의
 *   splitModelColor — 이미 계산되던 값을 재사용, 새 파싱 로직 추가 안 함)의
 *   정확 문자열 일치로만 한다.
 *
 * CPO 최종 승인 조건(2026-08-30) 2가지 반영:
 * 1) title 모델명만 같다고 CONFIRMED_PRODUCT로 올리지 않는다(구조화 코드
 *    완전일치만 CONFIRMED_PRODUCT). 모델명 일치 + 색상 같음/정보없음은
 *    VERY_SIMILAR까지만.
 * 2) title 모델명이 다르다는 이유만으로 CONFLICT 처리하되, URL exact/구조화
 *    코드 exact가 이미 위 단계에서 걸러진 뒤에만(더 강한 증거가 없을 때만)
 *    적용한다 — URL/구조화코드 완전일치가 항상 title 모델명 불일치보다 우선한다.
 */
import { splitModelColor } from "./match";
import type { ComparisonCandidate, ComparisonQuery, ComparisonSearchResult } from "./types";

export type ProductMatchTruth =
  | "EXACT_PRODUCT"
  | "CONFIRMED_PRODUCT"
  | "SAME_MODEL_VARIANT"
  | "VERY_SIMILAR"
  | "SIMILAR"
  | "CONFLICT"
  | "INSUFFICIENT_EVIDENCE";

/** 화면 정렬/우선순위용 — 값이 클수록 신뢰도가 높다(P-10의 MATCH_TRUTH_RANK와 같은 패턴). */
export const PRODUCT_MATCH_TRUTH_RANK: Record<ProductMatchTruth, number> = {
  EXACT_PRODUCT: 6,
  CONFIRMED_PRODUCT: 5,
  SAME_MODEL_VARIANT: 4,
  VERY_SIMILAR: 3,
  SIMILAR: 2,
  INSUFFICIENT_EVIDENCE: 1,
  CONFLICT: 0,
};

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeModelName(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** match.ts의 private extractSlug()와 동일 로직 — match.ts를 수정하지 않기 위해
 * (CPO 지시: 기존 match.ts 미변경) 여기 독립적으로 둔다. */
function extractSlug(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? last.replace(/\.html$/i, "").toLowerCase() : null;
  } catch {
    return null;
  }
}

/** "Article code: XXX" 형식 텍스트에서 코드를 뽑는다(shopify-suggest.ts의
 * extractArticleCode()와 동일 패턴 — "/" 포함 전체를 잡는다). description-facts.ts의
 * extractProductCode()는 "/"에서 끊기는 별도 정규식이고 도메스틱 파이프라인(P-7-B
 * MatchTruth) 전용이라 그쪽 동작을 바꾸지 않기 위해 재사용하지 않고 독립적으로 둔다. */
function extractArticleCodeFromDescription(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const match = /Article code:\s*([^.<\n]+)/i.exec(description);
  return match ? match[1].trim().slice(0, 100) : undefined;
}

/** STEP 1 실측(Bruno 실 스냅샷 확인) — product.sku.value는 원본 페이지에
 * "Article code: 01026-SOUFFLE-LOBELIA" 텍스트가 있어도 비어있는 경우가 흔하다
 * (추출기가 안 채움). query.sku가 명시적으로 있으면 그걸 우선하고, 없으면
 * description에서 직접 뽑는다 — 값을 지어내지 않는다. */
function resolveQueryCode(query: ComparisonQuery): string | null {
  const explicit = query.sku?.trim();
  if (explicit) return explicit;
  const fromDescription = extractArticleCodeFromDescription(query.description);
  return fromDescription ?? null;
}

export function deriveProductMatchTruth(
  query: ComparisonQuery,
  candidate: ComparisonCandidate,
  confidence: number,
): ProductMatchTruth {
  // 1. URL exact — 가장 강한 증거(자기 자신 재확인 등)
  if (query.sourceUrl) {
    const querySlug = extractSlug(query.sourceUrl);
    const candidateSlug = extractSlug(candidate.url);
    if (querySlug && candidateSlug && querySlug === candidateSlug) {
      return "EXACT_PRODUCT";
    }
  }

  // 2. 구조화 코드 exact — 세그먼트 해석 없이 정규화 후 완전 문자열 일치만.
  //    confidence가 낮아도(T10) 이 단계에서 CONFIRMED_PRODUCT로 확정한다.
  const queryCode = resolveQueryCode(query);
  const candidateCode = candidate.sku ?? null;
  if (queryCode && candidateCode && normalizeCode(queryCode) === normalizeCode(candidateCode)) {
    return "CONFIRMED_PRODUCT";
  }

  // 3. title 모델명(match.ts의 splitModelColor — 기존 계산값 재사용, 새 파싱
  //    로직 추가 안 함). "reliable"은 양쪽 다 "모델 in 색상 by 브랜드" 패턴이
  //    실제로 매칭됐을 때만(color !== null) — 패턴이 안 맞는 사이트(전체 title이
  //    그대로 model로 떨어지는 경우)는 신뢰 가능한 모델명으로 취급하지 않고
  //    4번 confidence 폴백으로 넘긴다(T5: 패턴 없는 사이트의 "유사하지만 다른
  //    title"이 성급하게 CONFLICT로 가지 않도록).
  const queryModel = splitModelColor(query.title);
  const candidateModel = splitModelColor(candidate.title);
  const modelNameReliable = queryModel.color !== null && candidateModel.color !== null;

  if (modelNameReliable) {
    const queryModelNorm = normalizeModelName(queryModel.model);
    const candidateModelNorm = normalizeModelName(candidateModel.model);
    if (queryModelNorm && candidateModelNorm && queryModelNorm === candidateModelNorm) {
      const queryColorNorm = normalizeModelName(queryModel.color!);
      const candidateColorNorm = normalizeModelName(candidateModel.color!);
      if (queryColorNorm !== candidateColorNorm) {
        return "SAME_MODEL_VARIANT";
      }
      // 모델명 동일 + 색상도 동일 — title 모델명만으로는 "동일상품 확정"까지
      // 올리지 않는다(대표님 지시: title 일치 = 강한 유사성 증거일 뿐,
      // 구조화 코드 일치와 섞지 않는다).
      return "VERY_SIMILAR";
    }
    // 모델명이 서로 명확히 다름 — 위에서 URL/구조화코드 exact가 이미 걸러졌으므로
    // 여기 도달했다는 건 그보다 강한 증거가 없다는 뜻. confidence가 아무리
    // 높아도(T9) 승격시키지 않는다.
    return "CONFLICT";
  }

  // 4. 모델명을 신뢰성 있게 못 뽑음 — 기존 confidence 등급(match.ts의
  //    classifyMatchLevel과 같은 경계값)으로 폴백.
  if (confidence >= 0.85) return "VERY_SIMILAR";
  if (confidence >= 0.7) return "SIMILAR";
  return "INSUFFICIENT_EVIDENCE";
}

/** searchComparisonShops()가 반환한 결과에 productMatchTruth를 얹는다 — 기존
 * candidates 배열/필드는 그대로 두고 새 필드만 추가한다(하위호환, 회귀 없음). */
export function attachProductMatchTruth(
  query: ComparisonQuery,
  results: ComparisonSearchResult[],
): ComparisonSearchResult[] {
  return results.map((result) => {
    if (result.status !== "ok" || result.candidates.length === 0) return result;
    const candidates = result.candidates.map((c) => ({
      ...c,
      productMatchTruth: deriveProductMatchTruth(query, c, c.confidence),
    }));
    return { ...result, candidates };
  });
}
