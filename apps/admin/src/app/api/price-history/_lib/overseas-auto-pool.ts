import { searchComparisonShops, type ComparisonQuery, type ComparisonSearchResult } from "@commerce/crawler";
import { sourceFitsScopes } from "@commerce/category";
import { isCollectableAccess, listComparisonShops } from "../../comparison-shops/_lib/comparison-shop";
import { OVERSEAS_AUTO_SHOP_ID, OVERSEAS_AUTO_SHOP_NAME } from "./transient-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-130 — **해외 비교 판매처 자동검색을 `/check` 에 공급하는 생산자**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **새 검색 시스템이 아니다.** 이 파일에는 검색 로직도 판정 로직도 없다 —
 *    `/api/comparison/search` 가 쓰는 **네 함수를 같은 순서로** 부르는 얇은 층이다:
 * ```
 * listComparisonShops()            등록부(= comparison_shops) 전수
 *   → isActive && isCollectableAccess && sourceFitsScopes   ← 🔴 세 필터 **그대로**
 *   → searchComparisonShops()      🟢 그 안에서 withConfidence 까지 끝난다
 *   → shopId 만 일시 id 로 **갈아** 넣는다
 * ```
 *
 * ── 🔴🔴🔴 이 파일이 존재하는 «단 하나의» 이유 — 저장 오염을 막는 것 ────────
 * ```
 * `searchComparisonShops` 의 shopId 는 `comparison_shops` 의 **실제 uuid** 다.
 * 그 값을 `/check` 의 후보 루프에 그대로 넣으면 그 루프가 「등록된 국내 샵」으로
 * 보고 `upsertDomesticProductLink` 를 부른다 ⟹ **해외 판매처가 국내 링크 테이블에
 * 저장된다**(= 국내 최저가·판정 입력·price_alerts 오염).
 * 🟢 그래서 id 를 `OVERSEAS_AUTO_SHOP_ID` 로 바꾼다 — 그 뒤는 Gemini/URL 후보와
 *    **한 줄도 다르지 않은** 기존 경로다(판정 → sink → 해외 집계).
 * ```
 *
 * ── 🔴 하지 «않는» 것 ──────────────────────────────────────────────────────
 * ```
 * ❌ 점수 재계산(withConfidence) — `searchOneShop` 이 **이미** 불렀다(실측: matchLevel 4/4)
 * ❌ 가격 보강(enrichCandidatePrices) — 어댑터의 `enrichScored` 가 이미 돈다
 *    🔴 그래서 이 산출물은 `transientPools`(재점수 + 가격보강 루프)로 보내지 «않는다»
 * ❌ 카테고리 scope 를 **다시 계산** — 호출부가 이미 가진 값을 받는다(복제 금지)
 * ❌ 외부 AI · Gemini · 새 provider · Registry 추가 · schema 변경 · DB 쓰기
 * ```
 */

/** 🔴 「왜 그 샵을 부르지 않았는가」를 잃지 않는다 — 조용히 버리지 않는다. */
export interface OverseasAutoPoolMetrics {
  /** 분모 — 등록부 전수(`comparison_shops`). */
  registrySources: number;
  /** 세 필터(활성 · 접근가능 · 카테고리)를 통과해 **부를 자격** 이 생긴 샵 수. */
  eligibleShops: number;
  /** 🔴 `status` 분포 그대로 — `ok`/`unsupported`/`not_configured`/`error`. */
  outcomes: Record<string, number>;
  /** 🔴 MI 로 넘어가는 후보 수(샵 전체 합). */
  candidates: number;
  /** 🟢 외부 AI/검색 provider 호출 수. **구조상 언제나 0** 이다. */
  providerCalls: 0;
}

export interface OverseasAutoPoolResult {
  /** 🟢 `searchResults` 에 그대로 append 할 수 있는 모양. 비면 호출부는 아무것도 안 한다. */
  searchResults: ComparisonSearchResult[];
  metrics: OverseasAutoPoolMetrics;
}

export interface OverseasAutoPoolInput {
  /**
   * 🔴 국내 경로가 이미 만든 **그 query 객체** 를 그대로 받는다. 해외 어댑터는
   *    `query.title` 로 검색하고 `withConfidence` 가 `facts` 를 쓴다 —
   *    `/api/comparison/search` 가 넘기는 것과 **같은 칸들** 이다.
   */
  query: ComparisonQuery;
  /**
   * 🔴 조사 대상 카테고리. **여기서 계산하지 않는다** — 호출부(`check/route.ts`)가
   *    `resolveMarketCategoryScopes`(= `selectedMarketSourceScopes ?? 자동추정`)로 이미
   *    정한 값이고, 그것이 `/api/comparison/search` 의 우선순위와 **같은 규칙** 이다.
   * 🔴 `null` 이면 필터가 걸리지 않는다 — `sourceFitsScopes` 의 기존 규약 그대로다.
   */
  categoryScopes: string[] | null;
  /** 🟢 테스트/측정용 주입구. 기본값이 **운영 함수** 다(이 저장소의 방식). */
  listShops?: typeof listComparisonShops;
  search?: typeof searchComparisonShops;
}

/**
 * 해외 비교 판매처 자동검색 1회 → **일시 shopId 를 단** `ComparisonSearchResult[]`.
 *
 * 🔴 **throw 하지 않는다.** `searchComparisonShops` 자체가 샵별 실패를 `status:"error"`
 *    로 격리하고, 등록부 조회 실패는 빈 배열이다(fail-soft).
 */
export async function collectOverseasAutoPool(input: OverseasAutoPoolInput): Promise<OverseasAutoPoolResult> {
  const listShops = input.listShops ?? listComparisonShops;
  const search = input.search ?? searchComparisonShops;
  const metrics: OverseasAutoPoolMetrics = {
    registrySources: 0,
    eligibleShops: 0,
    outcomes: {},
    candidates: 0,
    providerCalls: 0,
  };

  const all = await listShops();
  metrics.registrySources = all.length;
  /* 🔴 세 필터는 `/api/comparison/search` 의 그 줄과 **글자 그대로 같다** —
   *    판정을 두 번 구현하면 두 화면이 언젠가 다른 말을 한다(그 route 의 주석). */
  const shops = all.filter(
    (s) => s.isActive && isCollectableAccess(s.accessStatus) && sourceFitsScopes(s.categoryScope, input.categoryScopes),
  );
  metrics.eligibleShops = shops.length;
  if (shops.length === 0) return { searchResults: [], metrics };

  const results = await search(
    input.query,
    shops.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency })),
  );

  const searchResults: ComparisonSearchResult[] = [];
  for (const r of results) {
    metrics.outcomes[r.status] = (metrics.outcomes[r.status] ?? 0) + 1;
    metrics.candidates += r.candidates.length;
    searchResults.push({
      ...r,
      /** 🔴🔴 **여기가 이 파일의 전부다** — 실제 uuid 를 일시 id 로 바꾼다. */
      shopId: OVERSEAS_AUTO_SHOP_ID,
      /** 🔴 출처를 잃지 않는다 — 기존 두 생산자와 **같은 모양**(`접두 · host`). */
      shopName: `${OVERSEAS_AUTO_SHOP_NAME} · ${r.domain}`,
      /** 🟢 `domain` 은 손대지 않는다(품번 추출기 · 샵 대표 선택이 이 값으로 분기한다). */
    });
  }
  return { searchResults, metrics };
}
