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

interface DataLabResponse {
  results: { title: string; data: { period: string; ratio: number }[] }[];
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 최근 3개월(월 단위) 검색어트렌드 상대지수 중 가장 최근 구간 값을
 * 반환한다. 자격증명 미설정/API 오류/네트워크 실패는 전부 null — "확인 불가"로
 * 정직하게 처리하고, 낮음(0)으로 오인되지 않게 한다. */
export async function fetchNaverSearchTrendRatio(
  credentials: NaverDataLabCredentials,
  keyword: string,
): Promise<number | null> {
  if (!credentials.clientId || !credentials.clientSecret || !keyword.trim()) return null;

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
      return null;
    }
    const json = (await res.json()) as DataLabResponse;
    const series = json.results?.[0]?.data;
    if (!series || series.length === 0) {
      console.error("[naver-datalab] 결과 데이터 없음", { keyword, raw: JSON.stringify(json).slice(0, 300) });
      return null;
    }
    const latest = series[series.length - 1];
    return typeof latest.ratio === "number" ? Math.round(latest.ratio) : null;
  } catch (err) {
    console.error("[naver-datalab] fetch 예외", { message: err instanceof Error ? err.message : String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
