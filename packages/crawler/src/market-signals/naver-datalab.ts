/**
 * P-29 Sprint 7(CPO 지시, 2026-09-03) — Naver DataLab 검색어트렌드 API(무료,
 * 월 50,000회 한도, 대표님이 별도 앱 발급 후 Vercel env에 등록) 호출부.
 * 다른 Naver 자격증명 사용부(_lib/env.ts, account.ts)와 같은 패턴으로,
 * 크롤러 함수는 자격증명을 파라미터로만 받는다(env를 직접 읽지 않음 —
 * apps/admin 쪽에서 서버 env를 읽어 넘긴다).
 *
 * DataLab이 돌려주는 값은 "실제 검색량(건)"이 아니라 조회 구간 내 최고점을
 * 100으로 둔 상대지수다 — CPO 절대 금지 사항 1("무료 검색 데이터를 실제
 * 판매량처럼 표현하지 말 것")에 따라, 호출부 어디에서도 "검색량 N건"처럼
 * 절대 수치로 재해석하지 않고 항상 "상대지수"로만 노출한다.
 */
const DATALAB_ENDPOINT = "https://openapi.naver.com/v1/datalab/search";
const FETCH_TIMEOUT_MS = 8000;

export interface NaverDataLabCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * P-30(CPO 지시, 2026-09-03) — 기존에는 성공/실패/데이터없음이 전부 `null`
 * 하나로 뭉개져서, 호출부가 "정상적으로 조회했는데 검색 데이터가 없음"과
 * "인증 실패"를 구분할 수 없었다. 그 결과 실패까지 정상 데이터와 똑같이
 * 7일 캐싱되어 일시적 오류가 일주일간 고정되는 문제가 있었다.
 * 상태를 명시적으로 구분해 호출부가 캐시 TTL을 다르게 줄 수 있게 한다.
 *  - OK             정상 조회(ratio 존재)
 *  - NO_DATA        API는 정상(200)인데 해당 키워드 집계 결과가 없음
 *  - NOT_CONFIGURED 자격증명/키워드 미설정 — 외부 호출 자체를 하지 않았다
 *  - AUTH_ERROR     401/403 — 설정을 고치기 전에는 재시도해도 똑같다
 *  - REQUEST_ERROR  그 외 4xx — 요청 형식 문제, 역시 자체 회복되지 않는다
 *  - TRANSIENT_ERROR 429/5xx/네트워크/타임아웃 — 시간이 지나면 회복될 수 있다
 */
export type SearchTrendStatus =
  | "OK"
  | "NO_DATA"
  | "NOT_CONFIGURED"
  | "AUTH_ERROR"
  | "REQUEST_ERROR"
  | "TRANSIENT_ERROR";

export interface SearchTrendOutcome {
  status: SearchTrendStatus;
  /** OK일 때만 숫자. 그 외에는 항상 null — "낮음(0)"으로 오인되면 안 된다. */
  ratio: number | null;
  /** 네트워크 실패처럼 상태코드 자체가 없으면 null. */
  httpStatus: number | null;
}

interface DataLabResponse {
  results: { title: string; data: { period: string; ratio: number }[] }[];
}

/** HTTP 상태코드를 "재시도가 의미 있는가" 기준으로 분류한다. 429/5xx는
 * 시간이 지나면 회복될 수 있으므로 TRANSIENT, 401/403은 설정을 고치기 전에는
 * 똑같이 실패하므로 AUTH로 분리한다(호출부에서 TTL을 다르게 준다). */
function classifyHttpStatus(status: number): SearchTrendStatus {
  if (status === 401 || status === 403) return "AUTH_ERROR";
  if (status === 429 || status >= 500) return "TRANSIENT_ERROR";
  if (status >= 400) return "REQUEST_ERROR";
  return "TRANSIENT_ERROR";
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 최근 3개월(월 단위) 검색어트렌드 상대지수 중 가장 최근 구간 값을
 * 반환한다. 실패는 어떤 경우에도 ratio를 채우지 않는다 — "확인 불가"로
 * 정직하게 처리하고, 낮음(0)으로 오인되지 않게 한다. P-30부터는 실패 원인을
 * status로 구분해 돌려준다(호출부가 캐시 TTL을 다르게 주기 위해). 재시도는
 * 하지 않는다 — CEO API 호출량 보호 정책상 1회 시도만 한다. */
export async function fetchNaverSearchTrendRatio(
  credentials: NaverDataLabCredentials,
  keyword: string,
): Promise<SearchTrendOutcome> {
  if (!credentials.clientId || !credentials.clientSecret || !keyword.trim()) {
    return { status: "NOT_CONFIGURED", ratio: null, httpStatus: null };
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 3);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DATALAB_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Naver-Client-Id": credentials.clientId,
        "X-Naver-Client-Secret": credentials.clientSecret,
      },
      body: JSON.stringify({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        timeUnit: "month",
        keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // P-29 진단(2026-09-03) — 첫 실측 호출에서 ratio:null만 나오고 원인을
      // 알 수 없었다(CEO 호출량 보호 정책상 재호출로 디버깅하지 않는다) —
      // 다음 자연 호출(7일 캐시 만료 또는 CPO 승인 재확인)에서 원인이
      // 바로 보이도록 상태코드/본문을 로그에 남긴다.
      const bodyText = await res.text().catch(() => "");
      console.error("[naver-datalab] API 오류", { status: res.status, body: bodyText.slice(0, 300) });
      return { status: classifyHttpStatus(res.status), ratio: null, httpStatus: res.status };
    }
    const json = (await res.json()) as DataLabResponse;
    const series = json.results?.[0]?.data;
    if (!series || series.length === 0) {
      console.error("[naver-datalab] 결과 데이터 없음", { keyword, raw: JSON.stringify(json).slice(0, 300) });
      return { status: "NO_DATA", ratio: null, httpStatus: res.status };
    }
    const latest = series[series.length - 1];
    // 200이어도 ratio가 숫자가 아니면 값을 지어내지 않고 NO_DATA로 둔다.
    if (typeof latest.ratio !== "number") {
      return { status: "NO_DATA", ratio: null, httpStatus: res.status };
    }
    return { status: "OK", ratio: Math.round(latest.ratio), httpStatus: res.status };
  } catch (err) {
    // 타임아웃(abort)/네트워크 실패 — 시간이 지나면 회복될 수 있으므로
    // 영구 실패(AUTH/REQUEST)와 같은 TTL로 굳히지 않는다.
    console.error("[naver-datalab] fetch 예외", { message: err instanceof Error ? err.message : String(err) });
    return { status: "TRANSIENT_ERROR", ratio: null, httpStatus: null };
  } finally {
    clearTimeout(timer);
  }
}
