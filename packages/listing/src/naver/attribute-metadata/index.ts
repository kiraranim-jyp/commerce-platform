import type { NaverCategoryAttributeMeta } from "../attribute-resolver";
import category50000535 from "./category-50000535.json";

/** N-4.00 A-2(대표님 지시) — 카테고리별 실제 GET 메타데이터 레지스트리.
 * 여기 없는 categoryId는 아직 실측하지 않은 카테고리라 그대로 undefined를
 * 돌려준다(하드코딩 추정 금지 — 등록 라인은 이 값이 없으면 상품속성 매핑을
 * 그냥 건너뛴다, 등록을 막지 않는다). 새 카테고리를 추가하려면 반드시
 * `/v1/product-attributes/attributes`, `/attribute-values`를 실제로 GET해서
 * category-{id}.json 파일로 저장한 뒤 여기 등록한다 — 절대 값을 지어내지
 * 않는다. */
const REGISTRY: Record<string, { attributes: NaverCategoryAttributeMeta[] }> = {
  "50000535": category50000535 as { attributes: NaverCategoryAttributeMeta[] },
};

export function getNaverCategoryAttributeMeta(categoryId: string): NaverCategoryAttributeMeta[] | null {
  return REGISTRY[categoryId]?.attributes ?? null;
}
