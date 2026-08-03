import { fetch as coupangFetch, ProxyAgent } from "undici";
import { signCoupangRequest } from "./signing";
import type { CoupangCredentials } from "./env";

const COUPANG_API_BASE = "https://api-gateway.coupang.com";

/**
 * FIXIE_URL이 있을 때만 쿠팡 API 요청을 그 프록시로 내보낸다 — 없으면(로컬 개발 등)
 * dispatcher가 undefined가 되고 undici는 그 경우 자체 기본 dispatcher(직접 연결)를
 * 쓴다. setGlobalDispatcher()는 절대 쓰지 않는다: 이 파일이 Node 내장 전역 fetch가
 * 아니라 undici 패키지의 fetch를 직접 import해서 쓰기 때문에, 이 dispatcher는
 * 처음부터 앱의 다른 fetch 호출(크롤러, 이미지 다운로더 등 전역 fetch 사용처)과
 * 완전히 분리된 별도 풀이다 — 전역 fetch 동작에 영향을 줄 방법이 없다.
 *
 * 프록시 URL 자체는 절대 로그로 남기지 않는다(시크릿과 마찬가지로 취급).
 */
const fixieUrl = process.env.FIXIE_URL;
const coupangProxyDispatcher = fixieUrl ? new ProxyAgent(fixieUrl) : undefined;

/** TEMP DEBUG (P0-4 진단, 제거 예정) — 값은 절대 로그로 남기지 않고 로드 여부/길이만
 * 확인한다. cold start마다 한 번씩만 찍히면 충분하다. */
console.log(
  `[coupang-client][DEBUG] FIXIE_URL loaded=${Boolean(fixieUrl)} length=${fixieUrl?.length ?? 0} dispatcherCreated=${Boolean(coupangProxyDispatcher)}`,
);

/** 이전에는 타임아웃이 전혀 없어 응답이 올 때까지 무한 대기했다 — 프록시를 거치면
 * 왕복이 더 걸릴 수 있어, Vercel 함수 자체 제한에 걸려 죽기 전에 명확한 네트워크
 * 에러로 실패하도록 여유 있게 20초로 끊는다. */
const COUPANG_REQUEST_TIMEOUT_MS = 20_000;

export interface CoupangApiResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

/**
 * 서명 생성 + 실제 쿠팡 API 호출을 한 곳에서 담당한다 — 이 파일은 서버 라우트
 * 핸들러(app/api/coupang/**)에서만 import된다. credentials는 항상 호출부가
 * getCoupangCredentials()로 먼저 확인한 뒤 넘겨준다(여기서는 재확인하지 않는다 —
 * "인증정보 없음"과 "쿠팡이 인증을 거부함"을 호출부에서 이미 구분했기 때문).
 */
export async function callCoupangApi(
  credentials: CoupangCredentials,
  {
    method,
    path,
    query = "",
    body,
  }: { method: "GET" | "POST"; path: string; query?: string; body?: unknown },
): Promise<CoupangApiResponse> {
  const { authorization } = signCoupangRequest({
    method,
    path,
    query,
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
  });

  const url = `${COUPANG_API_BASE}${path}${query ? `?${query}` : ""}`;
  let res: Awaited<ReturnType<typeof coupangFetch>>;
  try {
    res = await coupangFetch(url, {
      method,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json;charset=UTF-8",
        "X-Requested-By": credentials.vendorId,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(COUPANG_REQUEST_TIMEOUT_MS),
      dispatcher: coupangProxyDispatcher,
    });
  } catch (err) {
    // TEMP DEBUG (P0-4 진단, 제거 예정) — undici가 던지는 TypeError("fetch
    // failed")는 실제 원인을 .cause에 숨긴다(DNS/TCP/TLS/proxy 중 어디서
    // 끊겼는지). 여기서 그 cause를 명시적으로 로그에 남겨서 "AUTH_FAILED"라는
    // 뭉뚱그려진 최종 메시지 대신 실제 실패 단계를 구분한다. 경로/시크릿은
    // 절대 남기지 않고 호스트만 남긴다.
    const dump = (e: unknown): Record<string, unknown> | unknown =>
      e instanceof Error
        ? {
            name: e.name,
            message: e.message,
            ...Object.fromEntries(Object.entries(e)),
            stackTop: e.stack?.split("\n").slice(0, 3),
            cause: e.cause !== undefined ? dump(e.cause) : undefined,
          }
        : e;
    console.error("[coupang-client][DEBUG] fetch threw", {
      host: new URL(url).host,
      method,
      usedProxy: Boolean(coupangProxyDispatcher),
      error: dump(err),
    });
    throw err;
  }

  let parsedBody: unknown = null;
  try {
    parsedBody = await res.json();
  } catch {
    parsedBody = null;
  }
  return { status: res.status, ok: res.ok, body: parsedBody };
}
