import type { CoupangCredentials } from "./env";
import { callCoupangApi } from "./client";

/**
 * CEO 지시(2026-08-03) — "추천 카테고리 없을시, 쿠팡의 카테고리 검색이 아닌, 목록을
 * 제공해 주면 어때?" predict API 기반 검색은 흔한 검색어(예: "원피스" 단독)에서
 * 실제로 관련 없는 카테고리를 주는 경우가 있다(score 낮음, 실측 확인) — 검색이
 * 안 맞을 때는 Wing처럼 대분류→소분류를 직접 눈으로 훑어 고르는 트리 탐색이
 * 더 정확하다. 예전엔 "쿠팡에 부모→자식 카테고리 목록 API가 없다"고 판단했었는데
 * (category-resolver-v3.ts 주석) 최신 Open API 문서 확인 결과 실제로 존재한다:
 * GET .../marketplace/meta/display-categories — 전체 카테고리를 트리로 반환.
 */
const CATEGORY_TREE_PATH = "/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories";

export interface CategoryTreeNode {
  displayItemCategoryCode: number;
  name: string;
  status: "ACTIVE" | "READY" | "DISABLED";
  child?: CategoryTreeNode[];
}

interface RawCategoryTreeResponse {
  code?: string;
  data?: CategoryTreeNode;
}

/** 전체 트리는 수천 노드 규모라 매 요청마다 다시 받아오면 느리고 레이트리밋
 * 위험도 있다 — 카테고리 구조는 하루에도 여러 번 안 바뀌므로 서버리스 인스턴스
 * 생존 기간 동안 메모리에 캐시한다(콜드 스타트마다 한 번만 실제 호출). */
let cachedTree: CategoryTreeNode | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

export async function fetchCategoryTree(credentials: CoupangCredentials): Promise<CategoryTreeNode | null> {
  const now = Date.now();
  if (cachedTree && now - cachedAt < CACHE_TTL_MS) return cachedTree;

  try {
    const response = await callCoupangApi(credentials, { method: "GET", path: CATEGORY_TREE_PATH });
    if (!response.ok) return cachedTree; // 실패 시 이전 캐시라도 있으면 그대로 반환
    const parsed = response.body as RawCategoryTreeResponse;
    if (!parsed.data) return cachedTree;
    cachedTree = parsed.data;
    cachedAt = now;
    return cachedTree;
  } catch {
    return cachedTree;
  }
}
