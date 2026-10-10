import { fetch as coupangFetch, type ProxyAgent } from "undici";
import { signCoupangRequest } from "./signing";
import type { CoupangCredentials } from "./env";
import { createOutboundProxyDispatcherAsync } from "@/lib/outbound-proxy";

const COUPANG_API_BASE = "https://api-gateway.coupang.com";

/**
 * 프록시가 있을 때만 쿠팡 API 요청을 그 프록시로 내보낸다 — 없으면(로컬 개발 등)
 * dispatcher가 undefined가 되고 undici는 그 경우 자체 기본 dispatcher(직접 연결)를
 * 쓴다. setGlobalDispatcher()는 절대 쓰지 않는다: 이 파일이 Node 내장 전역 fetch가
 * 아니라 undici 패키지의 fetch를 직접 import해서 쓰기 때문에, 이 dispatcher는
 * 처음부터 앱의 다른 fetch 호출(크롤러, 이미지 다운로더 등 전역 fetch 사용처)과
 * 완전히 분리된 별도 풀이다 — 전역 fetch 동작에 영향을 줄 방법이 없다.
 *
 * N-3.75(사용자 지시) — 여기서 직접 FIXIE_URL을 읽지 않고 공통 리졸버
 * (src/lib/outbound-proxy.ts, OCI_PROXY_URL 우선/FIXIE_URL 폴백)를 쓴다.
 * 프록시 URL 자체는 절대 로그로 남기지 않는다(시크릿과 마찬가지로 취급).
 *
 * ── 🔴 EGRESS ③ (2026-10-10) — 모듈 상수에서 «요청 시점» 해석으로 ────────────
 *
 * 모듈 로드 시 한 번 만들면 그 lambda 인스턴스는 평생 그 프록시로 나간다.
 * 셀러가 화면에서 전환해도 반영되지 않으므로(078 이 DB 로 간 이유가 그것이다)
 * 「어느 프록시를 쓸지」를 요청 시점에 정한다. ProxyAgent 자체는 URL 당 하나로
 * 재사용되므로 연결 풀의 수명·분리 원칙은 위 설명 그대로다.
 */
async function coupangProxyDispatcher(): Promise<ProxyAgent | undefined> {
  return createOutboundProxyDispatcherAsync();
}

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
  }: {
    /**
     * 🔴 이 union 은 «일부러» 좁다. 한동안 `"GET" | "POST"` 였고, 그것이
     * 「쿠팡 수정은 확인된 바 없다」는 사실을 타입으로 붙들고 있었다
     * (p0-channel-03-step6 조사 문서가 그 점을 근거로 들었다).
     *
     * 🔴 `PUT` 을 더한 근거는 «문서» 가 아니라 «실측» 이다
     * (COUPANG-UPDATE-CAPABILITY-01): GET 4건이 우리가 보낸 공식 필드를 100%
     * 돌려줬고, 공식 수정 API 가 그 전문을 되보내라고 지시한다.
     *
     * 🔴 그래도 `DELETE` 는 더하지 않는다. 쿠팡에 삭제 API 가 있지만 우리가 쓸
     * 이유가 없고, 여기 적히는 순간 누군가 쓸 수 있게 된다.
     */
    method: "GET" | "POST" | "PUT";
    path: string;
    query?: string;
    body?: unknown;
  },
): Promise<CoupangApiResponse> {
  const { authorization } = signCoupangRequest({
    method,
    path,
    query,
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
  });

  const url = `${COUPANG_API_BASE}${path}${query ? `?${query}` : ""}`;
  const res = await coupangFetch(url, {
    method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json;charset=UTF-8",
      "X-Requested-By": credentials.vendorId,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(COUPANG_REQUEST_TIMEOUT_MS),
    dispatcher: await coupangProxyDispatcher(),
  });

  let parsedBody: unknown = null;
  try {
    parsedBody = await res.json();
  } catch {
    parsedBody = null;
  }
  return { status: res.status, ok: res.ok, body: parsedBody };
}
