import { NextResponse } from "next/server";

/**
 * NAVER-PHASE0-AUTH-VERIFY(CPO 지시, 2026-09-09) — 진단 전용.
 *
 * Production이 계속 401("Authentication information are missing.")을 돌려주는데,
 * 엔드포인트와 헤더 이름은 공식 규격과 일치한다(POST /search-trend/v1/search,
 * X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY). 그러면 남는 변수는 **그 헤더에
 * 담기는 값이 어느 env에서 오는가** 하나뿐인데, 코드만 읽어서는 Vercel의 어느
 * 변수가 API HUB Application Key인지 알 방법이 없다 — 값을 볼 수 없기 때문이다.
 *
 * 그래서 추측하지 않고 두 후보 쌍을 각각 실제로 한 번씩 호출해서 가른다.
 * 이 라우트가 반환하는 것은 어느 쌍이 몇 번을 받았는지뿐이다 — 키 값도,
 * 길이도, 앞뒤 몇 글자도 남기지 않는다. 응답 본문은 NAVER가 주는 오류 문구만
 * 짧게 자른다(키가 실려 돌아오지 않는다).
 *
 * 캐시를 거치지 않는다 — market_signal_cache에 남은 AUTH_ERROR가 실제 호출을
 * 가려서 원인을 못 보게 만드는 상황을 피하는 것이 이 라우트의 존재 이유다.
 * 캐시에 쓰지도 않는다(진단 결과가 정상 경로의 판단을 오염시키면 안 된다).
 *
 * /api/admin 아래 두는 이유는 게이팅 때문이다. 처음에는 /api/debug에 두고
 * DEBUG_NAVER_PROBE_TOKEN으로 막았는데, 그 토큰의 값을 아는 사람이 아무도
 * 없었다 — 새로 발급하면 이번엔 그 값을 안전하게 전달할 방법이 필요해지고,
 * 진단 하나 돌리자고 새 secret을 만들어 주고받는 것은 그 자체가 위험이다.
 * /api/admin은 proxy가 admin 세션 쿠키로 이미 fail-closed로 막고 있으므로
 * (proxy.ts isAdminPath — 세션 없으면 401), 공유할 비밀값을 새로 만들지 않고도
 * 관리자만 실행할 수 있다. 관리자는 브라우저에서 이 URL을 열기만 하면 된다.
 */
const ENDPOINT = "https://naverapihub.apigw.ntruss.com/search-trend/v1/search";
const FETCH_TIMEOUT_MS = 10_000;
const BODY_SNIPPET_MAX = 200;

async function probe(
  label: string,
  rawId: string | undefined,
  rawSecret: string | undefined,
): Promise<Record<string, unknown>> {
  const clientId = rawId?.trim();
  const clientSecret = rawSecret?.trim();
  if (!clientId || !clientSecret) {
    return { pair: label, configured: false, result: "NOT_CONFIGURED" };
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 3);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        timeUnit: "month",
        keywordGroups: [{ groupName: "테스트", keywords: ["테스트"] }],
      }),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    return {
      pair: label,
      configured: true,
      httpStatus: res.status,
      ok: res.ok,
      // NAVER가 돌려주는 오류 문구만 짧게. 요청에 실어보낸 키는 응답에
      // 되돌아오지 않으므로 값이 새지 않는다.
      body: text.slice(0, BODY_SNIPPET_MAX),
    };
  } catch (error) {
    return { pair: label, configured: true, result: "FETCH_FAILED", name: (error as Error).name };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  // 인증은 proxy가 admin 세션으로 이미 처리했다 — 여기 도달했다는 것은
  // 관리자라는 뜻이다(세션이 없으면 proxy가 401로 끊는다).
  //
  // 두 후보를 순서대로 각각 1회씩만 호출한다(재시도 없음 — 호출량 보호 정책).
  const apiHub = await probe("NAVER_API_ACCESS_KEY/SECRET_KEY", process.env.NAVER_API_ACCESS_KEY, process.env.NAVER_API_SECRET_KEY);
  const datalab = await probe(
    "NAVER_DATALAB_CLIENT_ID/SECRET",
    process.env.NAVER_DATALAB_CLIENT_ID,
    process.env.NAVER_DATALAB_CLIENT_SECRET,
  );

  // 교차 조합도 본다 — id는 이쪽, secret은 저쪽에 들어가 있는 설정 실수라면
  // 위 두 쌍만으로는 영영 드러나지 않는다.
  const crossA = await probe("ACCESS_KEY + DATALAB_SECRET", process.env.NAVER_API_ACCESS_KEY, process.env.NAVER_DATALAB_CLIENT_SECRET);
  const crossB = await probe("DATALAB_ID + SECRET_KEY", process.env.NAVER_DATALAB_CLIENT_ID, process.env.NAVER_API_SECRET_KEY);

  return NextResponse.json({
    endpoint: ENDPOINT,
    note: "값은 어떤 형태로도 반환하지 않는다. httpStatus와 NAVER 오류 문구만 본다.",
    results: [apiHub, datalab, crossA, crossB],
  });
}
