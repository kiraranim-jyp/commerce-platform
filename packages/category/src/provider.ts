import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import type { CategoryCandidate } from "./types";
import type { CategoryPath } from "./platform-categories/types";

/**
 * 규칙 기반 구현(RuleBasedCategoryProvider)이 지금은 유일하지만, 실제 네이버/쿠팡
 * 카테고리 API나 AI 분류기를 나중에 붙일 때 이 인터페이스만 구현하면 된다 —
 * CommerceWorkspace나 어댑터 쪽 코드는 바뀔 필요가 없다.
 */
export interface CategoryProvider {
  /** 플랫폼의 전체 카테고리 목록(시드 데이터를 평탄화한 것). */
  getCategories(platform: PlatformId): CategoryPath[];
  /** 사용자가 카테고리를 직접 검색할 때 — 이름/경로에 query가 포함되는 것을 찾는다. */
  searchCategories(platform: PlatformId, query: string): CategoryPath[];
  /** CanonicalProduct를 보고 플랫폼에 맞는 카테고리 후보를 신뢰도 순으로 추천한다. */
  recommendCategory(product: CanonicalProduct, platform: PlatformId): CategoryCandidate[];
}
