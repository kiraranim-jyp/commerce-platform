import { callNaverApi } from "./client";
import type { NaverLeafCategory } from "@commerce/listing";

/**
 * Sprint N-2.9 — GET /v1/categories?last=true(N-2.4에서 확인한 실제 필드:
 * wholeCategoryName/id/name/last)를 서버에서 가져와 카테고리 매칭기에 넘긴다.
 * 리프 카테고리 전체 목록은 자주 안 바뀌는 데이터라 서버리스 인스턴스가
 * 살아있는 동안은 재사용한다(모듈 전역 캐시) — Vercel 콜드스타트마다 다시
 *받아오는 건 어쩔 수 없지만, 새 DB 테이블/외부 캐시를 추가하는 과설계는
 * 하지 않는다(CPO 원칙).
 */
let cache: { fetchedAt: number; categories: NaverLeafCategory[] } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface NaverCategoryListEntry {
  wholeCategoryName?: string;
  id?: string;
  last?: boolean;
}

export async function fetchNaverLeafCategories(accessToken: string): Promise<NaverLeafCategory[] | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.categories;
  }
  const result = await callNaverApi(accessToken, { method: "GET", path: "/v1/categories?last=true" });
  if (!result.ok || result.status !== 200) return null;
  const body = result.body;
  const list = Array.isArray(body) ? body : [];
  const categories: NaverLeafCategory[] = (list as NaverCategoryListEntry[])
    .filter((c) => c.wholeCategoryName && c.id)
    .map((c) => ({ id: c.id as string, wholeCategoryName: c.wholeCategoryName as string }));
  cache = { fetchedAt: Date.now(), categories };
  return categories;
}
