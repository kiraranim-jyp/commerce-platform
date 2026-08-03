import type { ProductSignals } from "@commerce/category";
import { scoreCategoryCandidate } from "@commerce/category";
import type { CoupangCredentials } from "./env";
import { callCoupangApi } from "./client";
import { fetchCategoryMeta } from "./category-meta";

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
/** predict 호출 횟수를 제한한다 — 쿠팡 API 레이트리밋과 Vercel 함수 시간 제한을
 * 동시에 지켜야 한다(Golden Dataset 검증 라우트와 같은 이유). */
const MAX_QUERY_VARIANTS = 3;

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

/** productType 힌트/브랜드를 붙인 질의 변형을 만든다 — 실측 사고의 근본
 * 원인(신호 없는 밋밋한 상품명만 predict API에 보냄)을 애초에 줄인다. 원본
 * 질의를 포함해 최대 MAX_QUERY_VARIANTS개로 제한한다. */
function buildQueryVariants(baseQuery: string, signals: ProductSignals, brand?: string): string[] {
  const variants: string[] = [baseQuery];
  if (signals.productType && !baseQuery.includes(signals.productType)) {
    variants.push(`${signals.productType} ${baseQuery}`);
  }
  if (brand && !baseQuery.toLowerCase().includes(brand.toLowerCase())) {
    variants.push(`${brand} ${baseQuery}`);
  }
  return variants.slice(0, MAX_QUERY_VARIANTS);
}

export async function resolveCategoryV3(
  credentials: CoupangCredentials,
  baseQuery: string,
  signals: ProductSignals,
  brand?: string,
): Promise<CategoryResolverV3Result> {
  const queries = buildQueryVariants(baseQuery, signals, brand);
  const seen = new Map<number, ScoredCategoryCandidate>();

  for (const query of queries) {
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
      if (code == null || !Number.isFinite(code) || !name) continue;
      // 이미 다른 질의 변형으로 같은 코드가 나왔으면 먼저 나온 채점 결과를
      // 유지한다(질의마다 다시 채점해도 같은 이름이라 결과가 같다 — 중복 계산만
      // 피한다).
      if (seen.has(code)) continue;
      const { score, reason, conflict } = scoreCategoryCandidate(name, [], signals);
      seen.set(code, { categoryCode: code, categoryName: name, query, score, reason, conflict, metaVerified: false });
    } catch {
      // 질의 변형 하나가 실패해도 나머지로 계속 진행한다 — 후보가 끝까지 0개일
      // 때만 REJECT로 처리한다.
    }
  }

  const ranked = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  // A-12.3-P0-2 — 상위 후보들만 실존 검증한다(전부 검증하면 predict 호출 +
  // meta 호출이 배로 늘어 Vercel 함수 시간 제한/쿠팡 레이트리밋에 걸릴 수
  // 있다 — MAX_QUERY_VARIANTS를 3으로 제한한 것과 같은 이유). 병렬로 호출해서
  // 지연을 최소화한다.
  const verified = await Promise.all(
    ranked.map(async (c) => {
      const meta = await fetchCategoryMeta(credentials, c.categoryCode);
      return { ...c, metaVerified: meta != null };
    }),
  );

  // A-12.3-P0-2 — 존재하지 않는(리프가 아니거나 폐지된) 코드는 "바로 등록
  // 가능"의 최상위 후보가 될 수 없다 — 점수가 가장 높아도 실존 검증을 통과한
  // 후보 중에서만 best를 고른다. 검증 통과 후보가 하나도 없으면(전부 무효)
  // REJECT — 그래도 candidates 배열 자체는(검증 실패 포함) 그대로 반환해서
  // 화면이 "왜 후보가 다 안 되는지" 보여줄 수 있게 한다.
  const verifiedOnly = verified.filter((c) => c.metaVerified);
  const best = verifiedOnly[0] ?? null;
  const decision: CategoryResolverV3Result["decision"] =
    best == null || best.conflict ? "REJECT" : best.score >= AUTO_SELECT_THRESHOLD ? "AUTO_SELECT" : "RECOMMEND";

  return { decision, best, candidates: verified };
}
