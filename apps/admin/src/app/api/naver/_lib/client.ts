import bcrypt from "bcryptjs";
import { fetch as naverFetch, FormData as UndiciFormData } from "undici";
import type { NaverCredentials } from "./env";
import { createOutboundProxyDispatcher, describeErrorCauseChain } from "@/lib/outbound-proxy";

const NAVER_OAUTH_TOKEN_URL = "https://api.commerce.naver.com/external/v1/oauth2/token";
const NAVER_API_BASE = "https://api.commerce.naver.com/external";

/**
 * Sprint N-1.0/N-1.2 — 네이버 커머스 API는 Coupang과 인증 프로토콜이 다르다(HMAC이
 * 아니다). 공식 문서(apicenter.commerce.naver.com/docs/auth) Node.js 예제 기준
 * 서명 방식:
 *   password = "{client_id}_{timestamp}" (timestamp는 13자리 ms epoch)
 *   client_secret_sign = base64(bcrypt(password, salt=client_secret))  ← 표준 base64
 * client_secret 자체가 bcrypt salt로 쓰인다. Coupang의 HMAC-SHA256과는 근본적으로
 * 다른 방식이라 signing.ts를 그대로 재사용할 수 없다(CPO 지시: 구조만 재사용,
 * 프로토콜은 문서 기준).
 *
 * N-1.1에서 URL-safe base64(base64url)로 바꿨다가 N-1.2에서 표준 base64로
 * 되돌렸다 — 공식 Node.js 예제는 URL-safe가 아닌 표준 base64를 쓴다(Java
 * 예제만 Base64.getUrlEncoder() 사용, Node/Java 예제를 섞으면 안 됨).
 *
 * export하는 이유: scripts/verify-naver-signature.ts에서 공식 문서의 샘플
 * 벡터(clientId/clientSecret/timestamp 고정값)로 이 함수의 출력이 공식 예제와
 * byte-level로 일치하는지 검증하기 위해서다(추측 구현 방지, CPO 지시).
 */
export function buildClientSecretSign(clientId: string, clientSecret: string, timestamp: number): string {
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  return Buffer.from(hashed, "utf8").toString("base64");
}

/**
 * Coupang(apps/admin/src/app/api/coupang/_lib/client.ts)과 동일한 패턴 —
 * 프록시가 있을 때만 이 전용 fetch 함수의 dispatcher로 프록시를 건다.
 * setGlobalDispatcher()는 쓰지 않는다(다른 fetch 호출과 완전히 분리된 풀).
 * Coupang과 Naver가 같은 프록시 값을 공유해도 되는 이유는 각자 독립된
 * ProxyAgent 인스턴스를 만들기 때문 — 서로 영향을 주지 않는다.
 *
 * N-3.75(사용자 지시) — 여기서 직접 FIXIE_URL을 읽지 않고 공통 리졸버
 * (src/lib/outbound-proxy.ts, OCI_PROXY_URL 우선/FIXIE_URL 폴백)를 쓴다.
 * 프록시 URL 자체(사용자/비밀번호 포함 가능)는 절대 로그로 남기지 않는다.
 */
const naverProxyDispatcher = createOutboundProxyDispatcher();

const NAVER_REQUEST_TIMEOUT_MS = 20_000;

export interface NaverTokenResult {
  ok: true;
  accessToken: string;
  expiresIn: number | null;
  raw: unknown;
}

export interface NaverTokenError {
  ok: false;
  step: "SIGNATURE_GENERATION_FAILED" | "TOKEN_REQUEST_FAILED" | "TOKEN_RESPONSE_INVALID" | "NETWORK_ERROR";
  httpStatus?: number;
  message: string;
  /** N-3.75 — NETWORK_ERROR일 때만 채워진다. error.cause 체인(호스트/포트/
   * 에러코드만 포함, 자격증명 없음)을 그대로 노출해 "fetch failed"보다 구체적인
   * 원인(예: 프록시 CONNECT 거부/타임아웃)을 진단할 수 있게 한다. */
  causeChain?: string[];
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
      causeChain: describeErrorCauseChain(error),
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

  const expiresIn =
    parsed && typeof parsed === "object" && "expires_in" in parsed
      ? (parsed as { expires_in: unknown }).expires_in
      : null;

  return {
    ok: true,
    accessToken,
    expiresIn: typeof expiresIn === "number" ? expiresIn : null,
    raw: parsed,
  };
}

/** N-3.49(2026-08-17, 실제 등록 4차 시도로 발견) — 상품 등록 API는 외부
 * URL(예: Supabase Storage)을 representativeImage.url/optionalImages[].url에
 * 직접 받지 않는다("올바른 이미지 파일이 아닙니다"로 거부됨). WebSearch로
 * 확인한 공식 커뮤니티 설명(commerce-api-naver discussions) — 반드시 이
 * "상품 이미지 다건 등록" API(POST /v1/product-images/upload)로 먼저
 * 업로드하고, 그 응답의 url을 등록 payload에 써야 한다. multipart/form-data,
 * 폼 필드명은 파일이 여러 개여도 항상 "imageFiles"(반복). */
export interface NaverImageUploadResult {
  ok: true;
  urls: string[];
  raw: unknown;
}
export interface NaverImageUploadError {
  ok: false;
  step: "FETCH_SOURCE_FAILED" | "API_REQUEST_FAILED" | "RESPONSE_PARSE_FAILED" | "NETWORK_ERROR";
  message: string;
  raw?: unknown;
}

export async function uploadNaverProductImages(
  accessToken: string,
  sourceImageUrls: string[],
): Promise<NaverImageUploadResult | NaverImageUploadError> {
  const formData = new UndiciFormData();
  for (const [index, sourceUrl] of sourceImageUrls.entries()) {
    let fetched: Response;
    try {
      fetched = await fetch(sourceUrl, { signal: AbortSignal.timeout(NAVER_REQUEST_TIMEOUT_MS) });
    } catch (error) {
      return {
        ok: false,
        step: "FETCH_SOURCE_FAILED",
        message: `원본 이미지(${sourceUrl})를 가져오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (!fetched.ok) {
      return {
        ok: false,
        step: "FETCH_SOURCE_FAILED",
        message: `원본 이미지(${sourceUrl}) 응답이 실패했습니다(HTTP ${fetched.status}).`,
      };
    }
    const contentType = fetched.headers.get("content-type") || "image/jpeg";
    const bytes = await fetched.arrayBuffer();
    const extension = contentType.includes("png") ? "png" : "jpg";
    formData.append("imageFiles", new Blob([bytes], { type: contentType }), `image-${index}.${extension}`);
  }

  try {
    const res = await naverFetch(`${NAVER_API_BASE}/v1/product-images/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
      signal: AbortSignal.timeout(NAVER_REQUEST_TIMEOUT_MS),
      dispatcher: naverProxyDispatcher,
    });
    let parsedBody: unknown = null;
    try {
      parsedBody = await res.json();
    } catch {
      parsedBody = null;
    }
    if (!res.ok) {
      return {
        ok: false,
        step: "API_REQUEST_FAILED",
        message: `네이버 이미지 업로드 API가 거부했습니다(HTTP ${res.status}).`,
        raw: parsedBody,
      };
    }
    // 실제 응답 키 구조가 공식 문서 원문으로 확정되지 않아(커뮤니티 설명상
    // "images" 목록만 확인됨), 흔히 쓰이는 후보 경로를 순서대로 시도한다 —
    // 어느 것도 안 맞으면 raw를 그대로 실어 호출부가 진단할 수 있게 한다.
    const body = parsedBody as Record<string, unknown> | null;
    const imageList =
      (body?.images as Array<Record<string, unknown>> | undefined) ??
      (body?.data as Array<Record<string, unknown>> | undefined) ??
      null;
    const urls = imageList?.map((entry) => entry?.url).filter((u): u is string => typeof u === "string") ?? [];
    if (urls.length !== sourceImageUrls.length) {
      return {
        ok: false,
        step: "RESPONSE_PARSE_FAILED",
        message: `이미지 업로드 응답에서 url을 예상한 개수만큼 파싱하지 못했습니다(기대 ${sourceImageUrls.length}, 파싱 ${urls.length}).`,
        raw: parsedBody,
      };
    }
    return { ok: true, urls, raw: parsedBody };
  } catch (error) {
    return {
      ok: false,
      step: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "네이버 이미지 업로드 API에 연결할 수 없습니다.",
    };
  }
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
 * 프록시를 거쳐 나가는지 확인해야 한다. ipify.org(공개 IP 에코 서비스)를 이
 * 파일과 동일한 dispatcher로 호출해서 실제 outbound IP를 알아낸다 — IP 값
 * 자체는 코드에 하드코딩하지 않고 응답에서 그대로 읽는다.
 *
 * N-3.75 — 이름은 유지 이력상 "Fixie"지만 이제 OCI_PROXY_URL이 설정돼 있으면
 * 그 프록시를 거쳐 나가는 IP를 알아낸다(naverProxyDispatcher가 공통 리졸버 결과다).
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

/** Access Token으로 실제 Commerce API를 호출한다 — Coupang callCoupangApi와 동일한 역할.
 * N-3.25(STEP 3) — POST /v2/products(실제 등록)를 이 함수로 호출하려면 body를
 * 보낼 수 있어야 해서 Coupang callCoupangApi와 같은 모양(body?: unknown, 있으면
 * JSON.stringify + Content-Type 헤더)으로 확장한다. GET 전용 호출부(auth-test,
 * resolve route 등)는 body를 안 넘기므로 동작이 그대로 유지된다. */
export async function callNaverApi(
  accessToken: string,
  { method, path, body }: { method: "GET" | "POST"; path: string; body?: unknown },
): Promise<NaverApiResponse | NaverApiError> {
  try {
    const res = await naverFetch(`${NAVER_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
