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

export interface ResolvedSearchTrendCredentials {
  clientId: string;
  clientSecret: string;
  /** 값 노출 없이 "공백/개행이 섞여 있었다"만 알리기 위한 플래그. */
  idTrimmed: boolean;
  secretTrimmed: boolean;
}

/**
 * PHASE 0-B(CPO 지시, 2026-09-09) — NAVER API HUB 이관의 마지막 조각.
 *
 * NAVER-API-HUB-2에서 endpoint와 헤더 이름(X-NCP-APIGW-API-KEY-ID/KEY)은
 * API HUB로 옮겼는데, 그 헤더에 넣을 **값**은 여전히 구 개발자센터 DataLab
 * 자격증명(NAVER_DATALAB_CLIENT_ID/SECRET)에서 읽고 있었다. 두 키는 발급처가
 * 다른 별개 체계라 인증이 통과할 수 없다 — 계속 잡히지 않던 401(errorCode
 * 024 "NID AUTH Result Invalid")의 실제 원인이다. 그동안 헤더 이름, request
 * schema, 공백 혼입까지 의심했지만 값의 출처가 틀려 있었다.
 *
 * 그래서 API HUB 키를 **우선** 쓰고, 구 DataLab 키는 fallback으로만 남긴다.
 * fallback을 남기는 이유는 회귀 위험 제거다 — API HUB env가 어떤 환경에서
 * 비어 있어도 이전과 똑같이 동작할 뿐 새로 깨지지 않는다.
 *
 * env 객체를 인자로 받는 순수 함수인 이유는 process.env를 건드리지 않고
 * 우선순위를 테스트하기 위해서다. 반환값에 자격증명 **값**이 담기므로
 * 이 결과를 로그/에러 메시지에 넣지 않는다.
 */
export function resolveSearchTrendCredentials(
  env: Record<string, string | undefined>,
): ResolvedSearchTrendCredentials | null {
  const rawId = env.NAVER_API_ACCESS_KEY ?? env.NAVER_DATALAB_CLIENT_ID;
  const rawSecret = env.NAVER_API_SECRET_KEY ?? env.NAVER_DATALAB_CLIENT_SECRET;
  const clientId = rawId?.trim();
  const clientSecret = rawSecret?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    idTrimmed: rawId!.length !== clientId.length,
    secretTrimmed: rawSecret!.length !== clientSecret.length,
  };
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

  // Beta-P2(2026-09-04) — 실측에서 DataLab이 HTTP 401을 돌려줬다
  // (errorCode 024 "NID AUTH Result Invalid"). 헤더 이름/요청 형식은 Naver
  // OpenAPI 규격과 일치하므로, 남는 흔한 원인은 대시보드에서 값을 붙여넣을 때
  // 섞여 들어간 앞뒤 공백/개행이다. 값이 깨끗하면 아무 것도 바뀌지 않고,
  // 공백이 섞여 있었다면 그것만으로 인증이 통과한다 — 위험 없는 방어 조치다.
  const resolved = resolveSearchTrendCredentials(process.env);
  if (!resolved) return { ratio: null, status: "NOT_CONFIGURED" };
  const { clientId, clientSecret, idTrimmed, secretTrimmed } = resolved;

  // 값은 절대 남기지 않는다 — trim으로 길이가 변했는지(=공백 혼입 여부)만
  // 기록해서 다음 자연 호출 때 401 원인을 값 노출 없이 확정할 수 있게 한다.
  if (idTrimmed || secretTrimmed) {
    console.warn("[market-signals] DataLab 자격증명에 공백/개행이 포함돼 있었다(trim 적용)", {
      idTrimmed,
      secretTrimmed,
    });
  }

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
