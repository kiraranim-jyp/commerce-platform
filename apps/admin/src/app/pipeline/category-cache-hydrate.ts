import type { CategoryCandidate } from "@commerce/category";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * P-13C-2 STEP3-B-UI 버그수정(2026-09-01) — CommerceWorkspace의 쿠팡 탭 자동
 * 하이드레이트 effect 안에 있던 "캐시를 보고 무엇을 할지" 판단 로직을 순수
 * 함수로 뽑았다. React effect 안에 남아있으면 실제 버그(page.tsx가 fetch
 * 응답을 버려서 캐시가 계속 undefined였던 문제)와 이 판단 로직 자체의 버그를
 * 구분해서 테스트할 방법이 없었다 — 특히 CPO가 최우선으로 의심한
 * "READY + REJECT + candidates:[]를 캐시 없음으로 오판하는지"는 조건문
 * 순서만 봐서는 확신할 수 없어 직접 실행해서 검증해야 했다.
 */
export type CategoryCacheHydrateAction =
  | {
      kind: "hydrate";
      candidates: CategoryCandidate[];
      resolverDecision: { decision: "AUTO_SELECT" | "RECOMMEND" | "REJECT"; score: number } | null;
      traceLine: string;
    }
  | { kind: "pending"; traceLine: string }
  | { kind: "failed"; traceLine: string }
  | { kind: "fetch" };

export function resolveCategoryCacheAction(
  cache: CanonicalProduct["categoryRecommendationCache"] | undefined,
): CategoryCacheHydrateAction {
  if (cache?.status === "READY") {
    return {
      kind: "hydrate",
      candidates: (cache.candidates ?? []).map((c) => ({
        id: String(c.categoryCode),
        name: c.categoryName,
        path: c.path && c.path.length > 0 ? c.path : [c.categoryName],
        hierarchy: c.hierarchy,
        platform: "coupang",
        confidence: c.score / 100,
        reason: cache.evidence ?? [],
        source: "ai",
        isVerifiedPlatformCode: c.metaVerified === true,
      })),
      resolverDecision: cache.resolverDecision ? { decision: cache.resolverDecision, score: cache.similarityScore ?? 0 } : null,
      traceLine: "→ 사전 확보된 추천 결과를 재사용합니다(외부 API 재호출 없음).",
    };
  }
  if (cache?.status === "PENDING") {
    return { kind: "pending", traceLine: "→ 추천 결과를 확보하는 중입니다..." };
  }
  if (cache?.status === "FAILED") {
    return {
      kind: "failed",
      traceLine: `→ 사전 확보 실패: ${cache.failureReason ?? "알 수 없는 오류"} — 아래에서 직접 검색해 주세요.`,
    };
  }
  return { kind: "fetch" };
}
