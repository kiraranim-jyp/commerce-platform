import { callNaverApi } from "./client";
import type { NaverCategoryTreeNode } from "@commerce/listing";

/**
 * Sprint N-2.9 — GET /v1/categories?last=true 대신(N-3.1 참고) 전체 목록을
 * 서버에서 가져와 카테고리 매칭기/hierarchy 복원기에 넘긴다. 카테고리 구조는
 * 자주 안 바뀌는 데이터라 서버리스 인스턴스가 살아있는 동안은 재사용한다
 * (모듈 전역 캐시) — Vercel 콜드스타트마다 다시 받아오는 건 어쩔 수 없지만,
 * 새 DB 테이블/외부 캐시를 추가하는 과설계는 하지 않는다(CPO 원칙).
 *
 * Sprint N-3.1 — `last=true` 없이 호출하면 non-leaf 노드까지 포함한 전체
 * flat tree(실측: 5815개 = leaf 4999 + non-leaf 816)가 나오고, non-leaf
 * 노드도 실제 id를 갖고 있다는 걸 debug/naver-category-raw 프로브로 확인했다
 * (문서에 없는 동작이라 추측하지 않고 실제로 찔러서 검증함). leaf의
 * wholeCategoryName을 ">"로 쪼갠 각 접두사가 이 전체 목록의 wholeCategoryName과
 * 정확히 일치하는 노드를 찾으면 그 노드의 id가 상위 카테고리의 실제 id다 —
 * 이걸로 category-hierarchy.ts의 buildNaverCategoryPath가 hierarchy를
 * 복원한다. N-2.9의 leaf 전용 목록은 이 전체 목록에서 `last===true`로
 * filter해서 파생한다(별도 API 호출을 늘리지 않는다).
 */
let allCache: { fetchedAt: number; categories: NaverCategoryTreeNode[] } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface NaverCategoryListEntry {
  wholeCategoryName?: string;
  id?: string;
  name?: string;
  last?: boolean;
}

/** leaf + non-leaf 전체 카테고리 목록. */
export async function fetchNaverAllCategories(accessToken: string): Promise<NaverCategoryTreeNode[] | null> {
  if (allCache && Date.now() - allCache.fetchedAt < CACHE_TTL_MS) {
    return allCache.categories;
  }
  const result = await callNaverApi(accessToken, { method: "GET", path: "/v1/categories" });
  if (!result.ok || result.status !== 200) return null;
  const body = result.body;
  const list = Array.isArray(body) ? body : [];
  const categories: NaverCategoryTreeNode[] = (list as NaverCategoryListEntry[])
    .filter((c) => c.wholeCategoryName && c.id && c.name && typeof c.last === "boolean")
    .map((c) => ({
      id: c.id as string,
      name: c.name as string,
      wholeCategoryName: c.wholeCategoryName as string,
      last: c.last as boolean,
    }));
  allCache = { fetchedAt: Date.now(), categories };
  return categories;
}
