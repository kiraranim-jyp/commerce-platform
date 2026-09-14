import { fetch as lotteOnFetch } from "undici";
import { createOutboundProxyDispatcher, describeErrorCauseChain } from "@/lib/outbound-proxy";
import { assertLotteOnEndpointAllowed } from "./forbidden-endpoints";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 1 — 롯데ON Open API HTTP 클라이언트.
 *
 * 쿠팡(HMAC 서명) · 네이버(bcrypt + OAuth)와 달리 롯데ON은 **정적 Bearer 키
 * 하나**다(조사 §5-1). 서명 계산이 없으므로 signing 모듈이 필요 없다.
 *
 * 대신 두 가지가 다르다:
 *  1) **IP allowlist가 필수다.** 키에 등록된 출발지 IP에서만 통한다. 그래서
 *     쿠팡/네이버와 똑같이 공통 아웃바운드 프록시(@/lib/outbound-proxy —
 *     OCI Tinyproxy → Fixie)를 거친다. Vercel 함수의 동적 IP로 나가면 무조건
 *     403이다.
 *  2) **HTTP 200이 성공을 뜻하지 않는다.** 응답 봉투의 `returnCode`가
 *     "0000"이어야 정상이다(조사 §5-1: "정상처리, 체크에서 에러값은
 *     리턴코드로 출력"). 이 파일이 그 파싱의 유일한 지점이다 — 호출부가
 *     각자 res.ok만 보고 성공으로 처리하는 일이 생기면 안 된다.
 *
 * 🔴 금지 엔드포인트 guard — 모든 요청은 assertLotteOnEndpointAllowed()를
 * 먼저 통과한다. `210 연동완료통보`를 비롯한 판매관리 쓰기 경로는 네트워크
 * 호출 전에 예외로 끊긴다(./forbidden-endpoints.ts 참고). 이 guard를 우회하는
 * 별도 fetch를 만들지 마라 — 그 순간 209 조회에 210이 따라붙는 사고가 가능해진다.
 */
const LOTTEON_API_BASE = "https://openapi.lotteon.com";

/**
 * 카테고리/속성/브랜드만 **다른 호스트**다(조사 §5-1). 2026-09-14 무자격 probe
 * 실측: Authorization 없음 → HTTP 401, 잘못된 Bearer → HTTP 401. 즉 공개
 * 엔드포인트가 아니라 같은 인증키를 요구한다(조사 §11-2 미확인 항목 해소).
 */
const LOTTEON_ONPICK_BASE = "https://onpick-api.lotteon.com";

const LOTTEON_REQUEST_TIMEOUT_MS = 20_000;

/** 네이버/쿠팡 client.ts와 동일 — setGlobalDispatcher를 쓰지 않고 이 파일 전용
 * dispatcher만 만든다(다른 채널 요청 풀과 완전히 분리). */
const lotteOnProxyDispatcher = createOutboundProxyDispatcher();

/** 조사 §5-1 — 문서가 명시한 필수 헤더. */
function buildHeaders(apiKey: string, hasBody: boolean): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Accept-Language": "ko",
    "X-Timezone": "GMT+09:00",
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
  };
}

export const LOTTEON_RETURN_CODE_OK = "0000";

export interface LotteOnApiResponse {
  ok: true;
  httpStatus: number;
  /** 응답 봉투의 returnCode. 봉투가 아닌 응답(HTML 에러 페이지 등)이면 null. */
  returnCode: string | null;
  /** returnCode === "0000" 일 때만 true. **호출부는 이 값을 봐야 한다.** */
  returnOk: boolean;
  message: string | null;
  dataCount: number | null;
  data: unknown;
  /** 파싱 원문(JSON이 아니면 null). 자격증명은 요청 헤더에만 있으므로 응답
   * 원문에는 키가 절대 포함되지 않는다. */
  raw: unknown;
}

export interface LotteOnApiError {
  ok: false;
  step: "NETWORK_ERROR" | "FORBIDDEN_ENDPOINT";
  message: string;
  causeChain?: string[];
}

interface LotteOnEnvelope {
  returnCode?: unknown;
  message?: unknown;
  subMessages?: unknown;
  dataCount?: unknown;
  data?: unknown;
}

/** 조사 §5-1 응답 봉투 `{returnCode, message, subMessages, dataCount, data}`. 봉투
 * 모양이 아니면(문서와 실동작이 다르면) 지어내지 않고 returnCode=null로 남긴다 —
 * 호출부가 "성공을 확인하지 못했다"로 처리하게 하기 위해서다. */
function parseEnvelope(parsed: unknown): Pick<LotteOnApiResponse, "returnCode" | "message" | "dataCount" | "data"> {
  if (parsed == null || typeof parsed !== "object") {
    return { returnCode: null, message: null, dataCount: null, data: null };
  }
  const envelope = parsed as LotteOnEnvelope;
  const returnCode = typeof envelope.returnCode === "string" ? envelope.returnCode : null;
  const baseMessage = typeof envelope.message === "string" ? envelope.message : null;
  // subMessages는 필드별 사유가 들어오는 자리다 — 있으면 합쳐서 보여준다
  // (Naver extractNaverErrorReason의 invalidInputs 처리와 같은 이유).
  const subMessages = Array.isArray(envelope.subMessages)
    ? envelope.subMessages
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .filter((item) => item && item !== "{}")
    : [];
  const message = [baseMessage, ...subMessages].filter(Boolean).join(" / ") || null;
  return {
    returnCode,
    message,
    dataCount: typeof envelope.dataCount === "number" ? envelope.dataCount : null,
    data: "data" in envelope ? envelope.data : null,
  };
}

async function request(
  apiKey: string,
  base: string,
  { method, path, query, body }: { method: "GET" | "POST"; path: string; query?: Record<string, string>; body?: unknown },
): Promise<LotteOnApiResponse | LotteOnApiError> {
  // 🔴 네트워크 호출 **전에** 막는다. throw를 여기서 잡아 결과 객체로 바꾸지
  // 않는 이유: 금지 엔드포인트 호출은 "실패한 API 호출"이 아니라 **버그**다.
  // 다만 라우트가 500으로 죽지 않도록 호출부가 구분할 수 있는 step은 남긴다.
  assertLotteOnEndpointAllowed(path);

  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }

  try {
    const res = await lotteOnFetch(url.toString(), {
      method,
      headers: buildHeaders(apiKey, body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(LOTTEON_REQUEST_TIMEOUT_MS),
      dispatcher: lotteOnProxyDispatcher,
    });

    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }

    const envelope = parseEnvelope(parsed);
    return {
      ok: true,
      httpStatus: res.status,
      ...envelope,
      returnOk: envelope.returnCode === LOTTEON_RETURN_CODE_OK,
      raw: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      step: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "롯데ON API 서버에 연결할 수 없습니다.",
      causeChain: describeErrorCauseChain(error),
    };
  }
}

/** `https://openapi.lotteon.com` 대상 호출. */
export function callLotteOnApi(
  apiKey: string,
  options: { method: "GET" | "POST"; path: string; query?: Record<string, string>; body?: unknown },
): Promise<LotteOnApiResponse | LotteOnApiError> {
  return request(apiKey, LOTTEON_API_BASE, options);
}

/** 카테고리/속성/브랜드 전용 호스트(`onpick-api.lotteon.com`). 같은 Bearer 키를
 * 쓰고 같은 guard를 통과한다 — 호스트가 다르다고 guard를 건너뛰지 않는다. */
export function callLotteOnPickApi(
  apiKey: string,
  options: { method: "GET" | "POST"; path: string; query?: Record<string, string>; body?: unknown },
): Promise<LotteOnApiResponse | LotteOnApiError> {
  return request(apiKey, LOTTEON_ONPICK_BASE, options);
}

/** 실제 아웃바운드 IP(= 롯데ON IP allowlist에 등록해야 할 값). 네이버
 * getFixieOutboundIp와 같은 목적/같은 dispatcher 원칙. */
export async function getLotteOnOutboundIp(): Promise<string | null> {
  if (!lotteOnProxyDispatcher) return null;
  try {
    const res = await lotteOnFetch("https://api.ipify.org?format=json", {
      dispatcher: lotteOnProxyDispatcher,
      signal: AbortSignal.timeout(LOTTEON_REQUEST_TIMEOUT_MS),
    });
    const body = (await res.json()) as { ip?: string };
    return body.ip ?? null;
  } catch {
    return null;
  }
}

/**
 * 조사 §5-2 기준 **읽기 전용(부작용 없음)** 경로 상수. 문자열을 호출부마다
 * 다시 적으면 오타 하나로 다른 API를 부를 수 있어서 여기 한 곳에만 둔다.
 * 이 목록에 쓰기 API를 추가하지 마라 — 쓰기는 상품등록(87) 하나뿐이고 그건
 * LOTTEON_WRITE_PATHS에 따로 있다.
 */
export const LOTTEON_READ_PATHS = {
  /** 207 — 파라미터 0개, 부작용 0. 연결 테스트 전용. */
  identity: "/v1/openapi/common/v1/identity",
  /** 209 — 주문(출고/회수지시) 조회. 별도 주문 상세 API가 없다(조사 §5-2). */
  ordersSearch: "/v1/openapi/delivery/v1/SellerDeliveryOrdersSearch",
  /** 93 / 94 — 상품 목록 / 상세 조회. */
  productList: "/v1/openapi/product/v1/product/list",
  productDetail: "/v1/openapi/product/v1/product/detail",
  /** 50 / 51 / 69 — 취소 · 반품 · 교환 **조회**. 승인/거부는 금지 목록에 있다. */
  cancellationSearch: "/v1/openapi/claim/v1/cancellationOpenApi/getCancellationRequestAndComplateList",
  returnSearch: "/v1/openapi/claim/v1/returningOpenApi/returnRequestSearch",
  exchangeSearch: "/v1/openapi/claim/v1/exchangeOpenApi/exchangeSearch",
  /** 205 / 206 — 표준 · 전시 카테고리(onpick-api 호스트). */
  onpickCheetah: "/cheetah/econCheetah.ecn",
} as const;

/** 이번 스프린트에서 허용된 **유일한** 쓰기(조사 §6-3 — 상품 축은 등록 후
 * 판매중지로 되돌릴 수 있어 기존 쿠팡/스마트스토어와 동일한 검증이 성립한다). */
export const LOTTEON_WRITE_PATHS = {
  /** 87 — 상품 등록 요청. */
  productRegistration: "/v1/openapi/product/v1/product/registration/request",
} as const;
