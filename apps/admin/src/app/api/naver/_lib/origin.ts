import { callNaverApi } from "./client";
import type { NaverOriginAreaCode } from "@commerce/listing";

/**
 * Sprint N-3.4 — `GET /v1/product-origin-areas`(commerce-api-naver
 * discussion #3632, 공식 계정 공지로 발견 — 카테고리(category.ts)와 같은
 * 이유로 GitHub 요약이 아니라 실제 production GET으로 535개 코드를 확인
 * 했다). 행정구역 개편 등으로 값이 바뀔 수 있다고 공지된 데이터라 하드코딩
 *하지 않고 카테고리 트리와 같은 패턴으로 캐시한다.
 */
let cache: { fetchedAt: number; areas: NaverOriginAreaCode[] } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface RawOriginAreaCodeName {
  code?: string;
  name?: string;
}

export async function fetchNaverOriginAreas(accessToken: string): Promise<NaverOriginAreaCode[] | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.areas;
  }
  const result = await callNaverApi(accessToken, { method: "GET", path: "/v1/product-origin-areas" });
  if (!result.ok || result.status !== 200) return null;
  const body = result.body as { originAreaCodeNames?: RawOriginAreaCodeName[] };
  const areas: NaverOriginAreaCode[] = (body.originAreaCodeNames ?? [])
    .filter((a) => a.code && a.name)
    .map((a) => ({ code: a.code as string, name: a.name as string }));
  cache = { fetchedAt: Date.now(), areas };
  return areas;
}
