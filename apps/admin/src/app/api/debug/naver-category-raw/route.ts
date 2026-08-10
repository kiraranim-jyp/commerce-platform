import { NextResponse } from "next/server";
import { getNaverCredentials } from "../../naver/_lib/env";
import { callNaverApi, issueNaverAccessToken } from "../../naver/_lib/client";

/**
 * N-3.1 조사 전용 진단 라우트 — GET /v1/categories/{id} raw 응답에 상위
 * 카테고리 계층(부모 id 등) 필드가 실제로 존재하는지 눈으로 직접 확인하기
 * 위한 것. N-2.8은 exceptionalCategories/certificationInfos만 골라 썼기
 * 때문에 나머지 필드를 아무도 본 적이 없다 — 추측하지 말고 raw JSON을
 * 그대로 보여준다(CPO 원칙). debug/navigate와 동일한 게이팅 패턴 재사용.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_NAVER_PROBE_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("id") ?? "50000349";

  const credentials = getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });
  }
  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json({ error: "AUTH_FAILED", detail: tokenResult }, { status: 200 });
  }

  const detail = await callNaverApi(tokenResult.accessToken, {
    method: "GET",
    path: `/v1/categories/${categoryId}`,
  });

  // last=true 없이 호출하면 non-leaf 노드까지 포함한 전체 flat tree가
  // 나온다는 걸 1차 probe로 확인했다 — 이 노드들 각각이 실제 id를 갖고
  // 있는지, 그 id로 leaf의 상위 경로를 100% 복원할 수 있는지 검증한다.
  const fullTreeResult = await callNaverApi(tokenResult.accessToken, { method: "GET", path: "/v1/categories" });

  let ancestorChainCheck: unknown = null;
  let counts: { total: number; leafCount: number; nonLeafCount: number } | null = null;
  if (fullTreeResult.ok && fullTreeResult.status === 200 && Array.isArray(fullTreeResult.body)) {
    const all = fullTreeResult.body as Array<{ id: string; wholeCategoryName: string; last: boolean }>;
    counts = {
      total: all.length,
      leafCount: all.filter((c) => c.last).length,
      nonLeafCount: all.filter((c) => !c.last).length,
    };
    const byName = new Map(all.map((c) => [c.wholeCategoryName, c]));
    const target = all.find((c) => c.id === categoryId);
    if (target) {
      const parts = target.wholeCategoryName.split(">");
      const chain = parts.map((_, i) => {
        const prefix = parts.slice(0, i + 1).join(">");
        const node = byName.get(prefix);
        return { prefix, id: node?.id ?? null, found: Boolean(node) };
      });
      ancestorChainCheck = { targetId: categoryId, wholeCategoryName: target.wholeCategoryName, chain };
    } else {
      ancestorChainCheck = { targetId: categoryId, found: false };
    }
  }

  return NextResponse.json({
    categoryDetailRaw: detail,
    fullTreeCounts: counts,
    ancestorChainCheck,
  });
}
