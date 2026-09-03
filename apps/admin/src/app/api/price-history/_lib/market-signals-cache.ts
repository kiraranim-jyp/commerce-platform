import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fetchNaverSearchTrendRatio, type SearchTrendStatus } from "@commerce/crawler";
import { isSearchInterestCacheFresh, type SearchInterestCacheValue } from "./market-signals-cache-policy";

/**
 * P-29 Sprint 7(CPO 지시, 2026-09-03) — Naver DataLab 검색어트렌드는 월
 * 50,000회 무료 한도가 있는 외부 API다(대표님 앱 발급, Vercel env 등록).
 * Vercel 서버리스 함수는 요청마다 새 프로세스라 인메모리 캐시가 불가능하므로,
 * 브랜드 단위로 market_signal_cache 테이블(마이그레이션 042)에 캐싱해서
 * "같은 브랜드 상품을 반복 조회해도 API를 매번 새로 부르지 않는다."
 *
 * CEO API 비용/호출량 보호 정책(2026-09-03) 준수:
 * - 실패 시 재시도하지 않는다(fetchNaverSearchTrendRatio 자체가 1회 시도,
 *   여기서도 재시도 로직을 추가하지 않는다).
 * - 캐시가 있으면(TTL 이내) 절대 API를 다시 부르지 않는다 — 상품 1건 조회
 *   과정에서 이 함수가 여러 번 불려도(브랜드가 같으면) 실제 API 호출은
 *   TTL 만료 전까지 0회다.
 * - 테이블이 없거나(마이그레이션 전) DB 오류가 나면 API를 부르지 않고
 *   조용히 null을 반환한다(호출량을 함부로 늘리지 않는다 — "확인 불가"로
 *   처리, 에러로 전체 요청을 막지 않는다).
 */
export function normalizeBrandKey(brand: string): string {
  return brand.trim().toLowerCase();
}

export interface SearchInterestResult {
  /** OK일 때만 숫자 — 실패/데이터없음은 항상 null("낮음 0"과 구분). */
  ratio: number | null;
  status: SearchTrendStatus;
}

interface CacheRow {
  cache_key: string;
  value_json: SearchInterestCacheValue;
  fetched_at: string;
}

/** brand(정규화 키) 기준 검색 관심 상대지수를 상태와 함께 반환한다. 캐시가
 * 신선하면 DB만 읽고 API를 부르지 않는다 — DataLab 자격증명이 없으면(env
 * 미설정) 애초에 캐시 miss여도 API를 시도하지 않는다. */
export async function getSearchInterestRatio(brand: string): Promise<SearchInterestResult> {
  const brandKey = normalizeBrandKey(brand);
  if (!brandKey) return { ratio: null, status: "NOT_CONFIGURED" };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ratio: null, status: "NOT_CONFIGURED" };

  const { data: cached, error: readErr } = await supabase
    .from("market_signal_cache")
    .select("cache_key, value_json, fetched_at")
    .eq("signal_type", "SEARCH_INTEREST")
    .eq("cache_key", brandKey)
    .maybeSingle();

  if (!readErr && cached) {
    const row = cached as CacheRow;
    const age = Date.now() - new Date(row.fetched_at).getTime();
    if (isSearchInterestCacheFresh(row.value_json, age)) {
      return { ratio: row.value_json.ratio, status: row.value_json.status ?? "OK" };
    }
  }

  const clientId = process.env.NAVER_DATALAB_CLIENT_ID;
  const clientSecret = process.env.NAVER_DATALAB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { ratio: null, status: "NOT_CONFIGURED" };

  const outcome = await fetchNaverSearchTrendRatio({ clientId, clientSecret }, brand);
  // CEO 호출량 보호 정책(2026-09-03) — 실제 외부 API 호출마다 로그를 남겨
  // 월 호출량을 나중에라도 Vercel 함수 로그에서 추적할 수 있게 한다.
  // P-30부터 status/httpStatus도 남긴다(ratio:null만으로는 원인 추적 불가).
  console.log("[market-signals] Naver DataLab search-trend 호출", {
    brandKey,
    status: outcome.status,
    httpStatus: outcome.httpStatus,
    ratio: outcome.ratio,
  });

  // 캐시 저장 실패(마이그레이션 전/DB 오류)는 조용히 무시 — 이번 요청
  // 결과는 그대로 반환하되, 다음 요청이 다시 API를 부르게 될 뿐 전체
  // 요청을 막지 않는다.
  await supabase
    .from("market_signal_cache")
    .upsert(
      {
        signal_type: "SEARCH_INTEREST",
        cache_key: brandKey,
        value_json: { ratio: outcome.ratio, keyword: brand, status: outcome.status },
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "signal_type,cache_key" },
    )
    .then(
      () => undefined,
      () => undefined,
    );

  return { ratio: outcome.ratio, status: outcome.status };
}
