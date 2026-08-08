import type { ProductSignals } from "@commerce/category";
import { getProductTypeExpectKeywords, scoreCategoryCandidate } from "@commerce/category";
import type { CoupangCredentials } from "./env";
import { callCoupangApi } from "./client";
import { fetchCategoryMeta } from "./category-meta";
import { fetchCategoryTree, type CategoryTreeNode } from "./category-tree";

/**
 * Sprint A-5(Category Resolver 3.0) — CPO 지시: "Predict → Resolver 검증 →
 * 말이 안되면 Reject → 차순위 후보 → 그래도 없으면 사용자 확인." 실측 사고
 * (파라슈트홈 베갯잇이 "원두커피믹스"로 예측됨)의 근본 원인은 predict API의
 * 단일 응답을 검증 없이 그대로 믿은 것이다.
 *
 * 쿠팡 predict API는 후보를 여러 개 주지 않는다(응답에 predictedCategoryId
 * 하나뿐 — Top5 조사 결과 확인됨). 그래서 "Top5 후보"는 predict API 한 번이
 * 아니라, 서로 다른 질의문(원본 상품명 / 상품유형 힌트를 붙인 질의 / 브랜드를
 * 붙인 질의)으로 여러 번 호출해서 나온 서로 다른 카테고리 코드를 모아
 * candidate pool로 만든다 — 같은 코드가 여러 질의에서 반복되면 dedupe한다.
 * 각 후보는 scoreCategoryCandidate(packages/category, 순수 함수)로 채점한다.
 */

const CATEGORY_PREDICT_PATH = "/v2/providers/openapi/apis/api/v1/categorization/predict";

/** CPO 지시: "95% 이상만 자동 선택, 그 이하는 추천만." */
const AUTO_SELECT_THRESHOLD = 95;
/** A-12.3-P0-3(CPO 2차 지시 — "최소 5~10개 정도의 후보") — predict 호출을
 * Promise.all로 병렬화해서(기존엔 순차 for-loop) 변형 개수를 늘려도 지연이
 * 크게 늘지 않는다. 그래도 무한정 늘리면 쿠팡 API 레이트리밋에 걸리므로
 * 상한은 둔다. */
const MAX_QUERY_VARIANTS = 8;
/** meta 존재 검증까지 하는 후보 상한 — 늘어난 MAX_QUERY_VARIANTS에 맞춰 5→10. */
const MAX_CANDIDATES = 10;
/** CPO 지시(2026-08-07, kids hat 실측 사례) — 트리 탐색으로 찾은 후보 중
 * 상위 몇 개까지 채점 대상에 넣을지. 너무 많이 넣으면 meta 검증 호출이
 * 늘어 레이트리밋 위험이 커진다 — predict 후보(MAX_CANDIDATES=10)와 합쳐도
 * 여유가 있는 선에서 제한한다. */
const MAX_TREE_SEARCH_CANDIDATES = 8;

interface TreeLeafMatch {
  code: number;
  name: string;
  path: string[];
}

/** 트리 전체를 훑어 리프 노드(등록 가능한 실제 말단 카테고리)의 경로 인덱스와,
 * 상품유형 키워드가 경로 어딘가에 있는 리프 목록을 한 번의 DFS로 함께
 * 만든다 — CategoryTreeBrowser(클라이언트)가 쓰는 것과 같은 "child가 없으면
 * 리프"라는 기준을 그대로 쓴다(판단 기준을 두 곳에 두지 않는다). */
function indexCategoryTree(
  tree: CategoryTreeNode,
  expectKeywords: string[] | undefined,
): { pathIndex: Map<number, string[]>; matches: TreeLeafMatch[] } {
  const pathIndex = new Map<number, string[]>();
  const matches: TreeLeafMatch[] = [];

  const walk = (node: CategoryTreeNode, ancestors: string[]) => {
    const path = [...ancestors, node.name];
    const isLeaf = !node.child || node.child.length === 0;
    if (!isLeaf) {
      for (const child of node.child ?? []) walk(child, path);
      return;
    }
    pathIndex.set(node.displayItemCategoryCode, path);
    if (node.status === "DISABLED" || !expectKeywords) return;
    const pathText = path.join(" ");
    if (expectKeywords.some((kw) => pathText.includes(kw))) {
      matches.push({ code: node.displayItemCategoryCode, name: node.name, path });
    }
  };
  walk(tree, []);

  return { pathIndex, matches };
}

export interface ScoredCategoryCandidate {
  categoryCode: number;
  categoryName: string;
  /** 이 후보를 만들어낸 질의문 — "왜 이 후보가 나왔는지" 설명 가능성용. */
  query: string;
  score: number;
  reason: string;
  conflict: boolean;
  /** A-12.3-P0-2(CPO 지시: "categoryCode → GetDisplayCategory → 실제 존재 여부
   * 검증까지 해야 한다") — predict API는 코드를 "추측"만 해줄 뿐, 그 코드가
   * 실제로 등록 가능한(말단/리프) 카테고리인지는 보장하지 않는다. 쿠팡에 별도
   * "카테고리 존재 검증" 전용 API는 없지만, category-meta 조회(등록 시점에
   * 이미 필수 호출하는 API)가 존재하지 않는 코드에는 필연적으로 실패하므로
   * (non-2xx → null) 이걸 존재 검증으로 그대로 재사용한다 — 새 엔드포인트를
   * 지어내지 않는다. null이면(=메타를 못 가져오면) "바로 등록 가능"으로
   * 표시하면 안 된다. */
  metaVerified: boolean;
}

export interface CategoryResolverV3Result {
  /** AUTO_SELECT(score>=95, 충돌 없음) / RECOMMEND(그 외 정상 후보) /
   * REJECT(후보가 없거나 최상위 후보마저 명백히 충돌). */
  decision: "AUTO_SELECT" | "RECOMMEND" | "REJECT";
  best: ScoredCategoryCandidate | null;
  /** 점수 내림차순, 최대 5개 — CPO 요구사항: "Top5 후보 비교". */
  candidates: ScoredCategoryCandidate[];
}

/** productType/브랜드/연령/성별 힌트 + CartPilot 규칙 기반 후보 이름을 조합해
 * 최대한 다양한 질의 변형을 만든다 — 실측 사고의 근본 원인(신호 없는 밋밋한
 * 상품명만 predict API에 보냄)을 줄이는 동시에, A-12.3-P0-3(CPO 2차 지시:
 * "Predict/Search/Rule/Parent Category를 합쳐서 추천")의 "Rule" 입력을
 * 실현한다 — CartPilot 자체 카테고리 규칙(ruleBasedNames, packages/category의
 * 키워드 매칭 결과)이 맞춘 카테고리 이름 그 자체를 predict 질의로 다시
 * 보내서, 그 이름에 대응하는 실제 쿠팡 코드를 얻고 존재 검증까지 거치게
 * 한다. (주의: 쿠팡은 키워드로 카테고리 코드 목록을 검색하는 별도 API나
 * 부모→자식 카테고리 목록 조회 API를 공개하지 않는다 — 이 코드베이스가 실제로
 * 가진 건 predict 1건→1코드 API와 코드 단위 meta 조회뿐이다. "Search"/"Parent
 * Category"는 그 두 API를 조합해 흉내 낼 방법이 없어 지어내지 않았다 — 대신
 * 질의 다양화로 실질적 커버리지를 최대한 넓힌다.) */
function buildQueryVariants(baseQuery: string, signals: ProductSignals, brand?: string, ruleBasedNames?: string[]): string[] {
  const variants: string[] = [baseQuery];
  const push = (q: string) => {
    if (q && !variants.some((v) => v.toLowerCase() === q.toLowerCase())) variants.push(q);
  };

  if (signals.productType) {
    if (!baseQuery.includes(signals.productType)) push(`${signals.productType} ${baseQuery}`);
    push(signals.productType);
  }
  if (brand && !baseQuery.toLowerCase().includes(brand.toLowerCase())) {
    push(`${brand} ${baseQuery}`);
  }
  if (signals.productType && signals.ageGroup && signals.ageGroup !== "unknown") {
    push(`${signals.ageGroup} ${signals.productType}`);
  }
  if (signals.productType && signals.gender && signals.gender !== "unknown") {
    push(`${signals.gender} ${signals.productType}`);
  }
  // CartPilot 규칙 기반(rule-based.provider.ts) 후보 이름 — CommerceWorkspace가
  // 클라이언트에서 이미 계산해 둔 걸 그대로 받는다(같은 판단을 서버에서
  // 다시 하지 않는다).
  for (const name of ruleBasedNames ?? []) {
    push(name);
    if (brand) push(`${brand} ${name}`);
  }

  return variants.slice(0, MAX_QUERY_VARIANTS);
}

export async function resolveCategoryV3(
  credentials: CoupangCredentials,
  baseQuery: string,
  signals: ProductSignals,
  brand?: string,
  ruleBasedNames?: string[],
): Promise<CategoryResolverV3Result> {
  const queries = buildQueryVariants(baseQuery, signals, brand, ruleBasedNames);

  // A-12.3-P0-3 — 기존엔 순차 for-loop라 변형을 늘릴수록 지연이 그대로
  // 늘었다. 각 질의는 서로 독립적이라 병렬로 호출해도 안전하다(레이트리밋은
  // MAX_QUERY_VARIANTS 상한으로 여전히 관리한다). 트리 조회(fetchCategoryTree)는
  // 6시간 캐시라 사실상 무료에 가까워 predict 호출들과 병렬로 같이 기다린다.
  const [predictResults, tree] = await Promise.all([
    Promise.all(
      queries.map(async (query) => {
        try {
          const response = await callCoupangApi(credentials, {
            method: "POST",
            path: CATEGORY_PREDICT_PATH,
            body: { productName: query, brand },
          });
          const body = response.body as {
            data?: { predictedCategoryId?: string; predictedCategoryName?: string };
          };
          const code = body.data?.predictedCategoryId ? Number(body.data.predictedCategoryId) : null;
          const name = body.data?.predictedCategoryName ?? null;
          if (code == null || !Number.isFinite(code) || !name) return null;
          return { query, code, name };
        } catch {
          // 질의 변형 하나가 실패해도 나머지로 계속 진행한다 — 후보가 끝까지
          // 0개일 때만 REJECT로 처리한다.
          return null;
        }
      }),
    ),
    fetchCategoryTree(credentials),
  ]);

  // CPO 지시(2026-08-07, kids hat 실측 사례) — predict API는 "kids 모자"처럼
  // 질의를 보정해도 정답 카테고리("영유아동...모자...공용")를 후보로 아예
  // 안 줄 때가 있다(상품명 텍스트 하나만 보는 분류기라 접두어를 안정적으로
  // 못 씀 — 실측 확인). 이미 트리 전체를 갖고 있으므로(category-tree.ts),
  // 상품유형 키워드로 트리를 직접 훑어 후보를 보강한다 — predict가 놓친
  // 정답도 채점 대상에 들어오게 된다. 트리 fetch 실패(null) 시에는 predict
  // 후보만으로 기존처럼 동작한다(신규 의존성이 기존 경로를 깨면 안 됨).
  const expectKeywords = signals.productType ? getProductTypeExpectKeywords(signals.productType) : undefined;
  const { pathIndex, matches } = tree
    ? indexCategoryTree(tree, expectKeywords)
    : { pathIndex: new Map<number, string[]>(), matches: [] as TreeLeafMatch[] };

  const seen = new Map<number, ScoredCategoryCandidate>();
  const addCandidate = (code: number, name: string, path: string[], query: string) => {
    // 이미 다른 경로(다른 질의 변형 또는 트리 탐색)로 같은 코드가 나왔으면
    // 먼저 나온 채점 결과를 유지한다(같은 코드는 경로도 같아 다시 채점해도
    // 결과가 같다 — 중복 계산만 피한다).
    if (seen.has(code)) return;
    const { score, reason, conflict } = scoreCategoryCandidate(name, path, signals);
    seen.set(code, { categoryCode: code, categoryName: name, query, score, reason, conflict, metaVerified: false });
  };

  for (const result of predictResults) {
    if (!result) continue;
    addCandidate(result.code, result.name, pathIndex.get(result.code) ?? [], result.query);
  }

  // 트리 탐색 매치가 많을 수 있으므로(흔한 상품유형은 매치가 수십 개일 수
  // 있음) 먼저 채점해서 상위 몇 개만 후보 풀에 합친다 — meta 검증(실제 API
  // 호출)까지 가는 건 이 상한(MAX_TREE_SEARCH_CANDIDATES) 안에서만이다.
  const topTreeMatches = matches
    .map((m) => ({ ...m, score: scoreCategoryCandidate(m.name, m.path, signals).score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_TREE_SEARCH_CANDIDATES);
  for (const match of topTreeMatches) {
    addCandidate(match.code, match.name, match.path, `[트리 탐색: ${signals.productType}]`);
  }

  const ranked = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);
  // A-12.3-P0-2 — 상위 후보들만 실존 검증한다(전부 검증하면 meta 호출이 배로
  // 늘어 Vercel 함수 시간 제한/쿠팡 레이트리밋에 걸릴 수 있다). 병렬로
  // 호출해서 지연을 최소화한다.
  const verified = await Promise.all(
    ranked.map(async (c) => {
      const meta = await fetchCategoryMeta(credentials, c.categoryCode);
      return { ...c, metaVerified: meta != null };
    }),
  );

  // A-12.3-P0-4(CPO 3차 지시 — regression 수정: "추천이 항상 살아있어야
  // 한다") — 직전 커밋에서 "검증 통과한 것만 반환"으로 바꿨더니, meta 조회가
  // 레이트리밋/네트워크 문제로 실패하는 순간 후보가 통째로 0개가 되어 추천·
  // 검색이 동시에 죽는 회귀가 발생했다(실측 확인됨). "존재하지 않는 카테고리를
  // 등록 가능처럼 보이면 안 된다"는 원래 취지는 옳지만, 그 판단은 candidates를
  // 아예 숨기는 게 아니라 각 후보에 metaVerified 배지를 붙여 화면(①/② 구간)이
  // 구분해서 보여주는 방식으로 지켜야 한다 — 검증에 실패해도 최소한 "여기 후보가
  // 있다"는 사실 자체는 항상 보여준다.
  const verifiedOnly = verified.filter((c) => c.metaVerified);
  const best = verifiedOnly[0] ?? verified[0] ?? null;
  const decision: CategoryResolverV3Result["decision"] =
    best == null
      ? "REJECT"
      : best.conflict
        ? "REJECT"
        : best.metaVerified && best.score >= AUTO_SELECT_THRESHOLD
          ? "AUTO_SELECT"
          : "RECOMMEND";

  return { decision, best, candidates: verified };
}
