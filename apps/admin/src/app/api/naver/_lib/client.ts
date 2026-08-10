import bcrypt from "bcryptjs";
import { fetch as naverFetch, ProxyAgent } from "undici";
import type { NaverCredentials } from "./env";

const NAVER_OAUTH_TOKEN_URL = "https://api.commerce.naver.com/external/v1/oauth2/token";
const NAVER_API_BASE = "https://api.commerce.naver.com/external";

/**
 * Sprint N-1.0 — 네이버 커머스 API는 Coupang과 인증 프로토콜이 다르다(HMAC이
 * 아니다). 공식 문서(및 3개 독립 자료 교차검증) 기준 서명 방식:
 *   password = "{client_id}_{timestamp}" (timestamp는 13자리 ms epoch)
 *   client_secret_sign = base64(bcrypt(password, salt=client_secret))
 * client_secret 자체가 bcrypt salt로 쓰인다 — 네이버가 발급하는 client secret이
 * "$2a$..." 형식의 유효한 bcrypt salt라는 뜻이다. Coupang의 HMAC-SHA256과는
 * 근본적으로 다른 방식이라 signing.ts를 그대로 재사용할 수 없다(CPO 지시: 구조만
 * 재사용, 프로토콜은 문서 기준).
 */
function buildClientSecretSign(clientId: string, clientSecret: string, timestamp: number): string {
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  return Buffer.from(hashed, "utf8").toString("base64");
}

/**
 * Coupang(apps/admin/src/app/api/coupang/_lib/client.ts)과 동일한 패턴 —
 * FIXIE_URL이 있을 때만 이 전용 fetch 함수의 dispatcher로 프록시를 건다.
 * setGlobalDispatcher()는 쓰지 않는다(다른 fetch 호출과 완전히 분리된 풀).
 * Coupang과 Naver가 같은 FIXIE_URL 값을 공유해도 되는 이유는 각자 독립된
 * ProxyAgent 인스턴스를 만들기 때문 — 서로 영향을 주지 않는다.
 *
 * 프록시 URL 자체(사용자/비밀번호 포함 가능)는 절대 로그로 남기지 않는다.
 */
const fixieUrl = process.env.FIXIE_URL;
const naverProxyDispatcher = fixieUrl ? new ProxyAgent(fixieUrl) : undefined;

const NAVER_REQUEST_TIMEOUT_MS = 20_000;

export interface NaverTokenResult {
  ok: true;
  accessToken: string;
  raw: unknown;
}

export interface NaverTokenError {
  ok: false;
  step: "SIGNATURE_GENERATION_FAILED" | "TOKEN_REQUEST_FAILED" | "TOKEN_RESPONSE_INVALID" | "NETWORK_ERROR";
  httpStatus?: number;
  message: string;
  body?: unknown;
}

/**
 * Access Token 발급. 문서상 seller_id 파라미터는 없다(type=SELF가 API Center에서
 * 연결한 단일 스토어 자체를 가리킴) — CPO 지시대로 seller_id를 임의로 넣지 않는다.
 */
export async function issueNaverAccessToken(
  credentials: NaverCredentials,
): Promise<NaverTokenResult | NaverTokenError> {
  const timestamp = Date.now();
  let clientSecretSign: string;
  try {
    clientSecretSign = buildClientSecretSign(credentials.clientId, credentials.clientSecret, timestamp);
  } catch (error) {
    // client_secret이 유효한 bcrypt salt 형식("$2a$..." 등)이 아니면 bcryptjs가
    // 여기서 던진다 — 네트워크 요청 전에 걸러서 "값 자체가 이상하다"를 구분해준다.
    return {
      ok: false,
      step: "SIGNATURE_GENERATION_FAILED",
      message:
        error instanceof Error
          ? `서명 생성 실패(client_secret 형식 문제일 수 있음): ${error.message}`
          : "서명 생성에 실패했습니다.",
    };
  }

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    timestamp: String(timestamp),
    client_secret_sign: clientSecretSign,
    grant_type: "client_credentials",
    type: "SELF",
  });

  let res: Awaited<ReturnType<typeof naverFetch>>;
  try {
    res = await naverFetch(NAVER_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(NAVER_REQUEST_TIMEOUT_MS),
      dispatcher: naverProxyDispatcher,
    });
  } catch (error) {
    return {
      ok: false,
      step: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "네이버 인증 서버에 연결할 수 없습니다.",
    };
  }

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      step: "TOKEN_REQUEST_FAILED",
      httpStatus: res.status,
      message: "네이버가 토큰 발급 요청을 거부했습니다.",
      body: parsed,
    };
  }

  const accessToken =
    parsed && typeof parsed === "object" && "access_token" in parsed
      ? (parsed as { access_token: unknown }).access_token
      : null;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return {
      ok: false,
      step: "TOKEN_RESPONSE_INVALID",
      httpStatus: res.status,
      message: "네이버 응답에 access_token이 없습니다.",
      body: parsed,
    };
  }

  return { ok: true, accessToken, raw: parsed };
}

export interface NaverApiResponse {
  ok: true;
  status: number;
  body: unknown;
}

export interface NaverApiError {
  ok: false;
  step: "API_REQUEST_FAILED" | "NETWORK_ERROR";
  message: string;
}

/**
 * work order 9번 — "FIXIE_URL이 존재한다"는 성공 조건이 아니라 실제 요청이
 * Fixie를 거쳐 나가는지 확인해야 한다. ipify.org(공개 IP 에코 서비스)를 이
 * 파일과 동일한 dispatcher로 호출해서 실제 outbound IP를 알아낸다 — IP 값
 * 자체는 코드에 하드코딩하지 않고 응답에서 그대로 읽는다.
 */
export async function getFixieOutboundIp(): Promise<string | null> {
  if (!naverProxyDispatcher) return null;
  try {
    const res = await naverFetch("https://api.ipify.org?format=json", {
      dispatcher: naverProxyDispatcher,
      signal: AbortSignal.timeout(NAVER_REQUEST_TIMEOUT_MS),
    });
    const body = (await res.json()) as { ip?: string };
    return body.ip ?? null;
  } catch {
    return null;
  }
}

/** Access Token으로 실제 Commerce API를 호출한다 — Coupang callCoupangApi와 동일한 역할. */
export async function callNaverApi(
  accessToken: string,
  { method, path }: { method: "GET" | "POST"; path: string },
): Promise<NaverApiResponse | NaverApiError> {
  try {
    const res = await naverFetch(`${NAVER_API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(NAVER_REQUEST_TIMEOUT_MS),
      dispatcher: naverProxyDispatcher,
    });
    let parsedBody: unknown = null;
    try {
      parsedBody = await res.json();
    } catch {
      parsedBody = null;
    }
    return { ok: true, status: res.status, body: parsedBody };
  } catch (error) {
    return {
      ok: false,
      step: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "네이버 API 서버에 연결할 수 없습니다.",
    };
  }
}
