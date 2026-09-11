import { detectCategoryProfile, detectionMarketSourceScopes, resolveProductSignals } from "@commerce/category";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";

/**
 * TTAEJYO 2.0(CEO 지시, 2026-09-12) — "어느 판매처가 이 상품에 맞는가"를 정한다.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * domestic_price_sources에는 category_scope(text[]) 컬럼이 마이그레이션 029부터
 * 있었고, 값도 이미 채워져 있다(KIDS_FASHION / KIDS_GOODS). 그런데 검색 경로가
 * 그 컬럼을 **한 번도 읽지 않았다**. 그래서 어떤 상품을 넣든 아동복 편집샵
 * 전부를 매번 크롤링했다. 여성 원피스를 넣어도 아동복 편집샵 12곳을 뒤지고,
 * 0건이 나오면 화면은 "국내 비교상품 없음"이라고 말한다 — 사실은 "맞는
 * 판매처를 한 곳도 뒤지지 않았다"인데 말이다.
 *
 * ── 사이트 이름을 코드에 적지 않는다 ─────────────────────────────────────
 * 여기서 하는 일은 카테고리 범위(문자열 배열)를 정하는 것뿐이고, 어느 도메인이
 * 그 범위에 드는지는 전적으로 카탈로그(domestic_price_sources.category_scope)가
 * 정한다. 새 카테고리 전문 편집샵이 생기면 SQL 한 줄이고, 이 파일은 그대로다.
 *
 * ── 모르면 전부 뒤진다 ───────────────────────────────────────────────────
 * 카테고리를 못 정하면 null을 돌려주고, 호출부는 필터를 아예 걸지 않는다 =
 * 오늘과 완전히 같은 동작이다. 추정이 빗나갔을 때 손해가 "쓸데없는 크롤링"이
 * 아니라 "비교 대상 실종"이 되는 쪽으로 실패하지 않게 하는 장치다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

export interface CategoryScopeInput {
  title: string;
  description?: string;
  brand?: string;
  sourceUrl?: string;
  breadcrumbPath?: string[];
  recommendedAge?: string;
}

/**
 * 이 상품에 맞는 국내 판매처 범위. 정하지 못하면 null(= 필터 없음).
 *
 * resolveProductSignals는 CanonicalProduct의 일부 필드만 읽는 순수 함수라
 * (외부 호출 없음) 검색 라우트처럼 스냅샷 전체가 없는 자리에서도 쓸 수 있다 —
 * 다만 없는 신호를 채워 넣지는 않는다. breadcrumb이 없으면 그만큼 덜 아는
 * 채로 판단하고, 덜 알면 null이 나온다.
 */
export function resolveCategoryScopes(input: CategoryScopeInput): string[] | null {
  const signals = resolveProductSignals({
    title: field(input.title),
    description: field(input.description ?? ""),
    brand: field(input.brand ?? ""),
    recommendedAge: field(input.recommendedAge ?? ""),
    breadcrumbPath: input.breadcrumbPath,
    jsonLdCategory: undefined,
    sourceUrl: input.sourceUrl ?? "",
    shopifyTags: undefined,
    shopifyProductType: undefined,
  });
  const detection = detectCategoryProfile(
    signals,
    `${input.title} ${input.description ?? ""} ${(input.breadcrumbPath ?? []).join(" ")}`,
    input.brand ?? "",
  );
  return detection ? detectionMarketSourceScopes(detection) : null;
}

/** 스냅샷이 통째로 있는 경로(일일 확인·지금 확인)에서 쓰는 짝. 같은 판정을
 * 두 번 구현하지 않기 위해 위 함수로 그대로 넘긴다. */
export function resolveCategoryScopesFromProduct(product: CanonicalProduct): string[] | null {
  return resolveCategoryScopes({
    title: product.title.value,
    description: product.description.value,
    brand: product.brand.value,
    sourceUrl: product.sourceUrl,
    breadcrumbPath: product.breadcrumbPath,
    recommendedAge: product.recommendedAge.value,
  });
}
