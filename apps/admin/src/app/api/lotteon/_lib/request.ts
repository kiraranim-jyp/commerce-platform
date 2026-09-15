import { NextResponse } from "next/server";
import { getOutboundProxyDiagnostics } from "@/lib/outbound-proxy";
import { getLotteOnCredentials } from "./env";
import { callLotteOnApi, callLotteOnPickApi, type LotteOnApiError, type LotteOnApiResponse } from "./client";
import {
  classifyLotteOnHttpStatus,
  classifyLotteOnNetworkError,
  classifyLotteOnReturnCode,
} from "./connection-error";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 2 — 조회 라우트들이 공유하는 실행 껍데기.
 *
 * 이걸 만든 이유는 하나다: **returnCode 판정을 라우트마다 다시 쓰지 않기 위해서**다.
 * 롯데ON은 HTTP 200이어도 실패일 수 있어서(조사 §5-1), 라우트 하나가 res.ok만
 * 보고 성공 처리하면 그 화면만 조용히 거짓말을 하게 된다.
 *
 * 실패는 전부 HTTP 200 + `{ ok: false, ... }`로 내려간다 — 화면이 상태코드가
 * 아니라 본문을 읽게 하려는 것(기존 auth-test 라우트들과 같은 규약).
 */
export interface LotteOnRouteSuccess<T = unknown> {
  ok: true;
  data: T;
  dataCount: number | null;
  returnCode: string | null;
}

export type LotteOnHost = "openapi" | "onpick";

/**
 * LOTTEON-TIMEOUT-1(2026-09-15 실측) — **실패한 호출이 스스로 이름을 대게 한다.**
 *
 * ── 왜 필요했나 ───────────────────────────────────────────────────────────
 * CEO가 ⑤배송에서 본 문장은 "롯데ON 응답이 제한 시간 안에 오지 않았습니다."
 * **하나**였다. 그 한 줄로는 아무것도 못 고른다:
 *   · 207인가 150인가 166인가 89인가 (배송 설정 조회는 5회 직렬이다)
 *   · 20초를 다 쓰고 죽었나, 빨리 죽었나
 *   · 롯데ON까지 갔다가 늦은 것인가, 아웃바운드 프록시에서 막힌 것인가
 * 다음 조사가 또 맨땅에서 시작하지 않도록 이 세 가지를 실패 응답과 서버 로그에
 * 같이 싣는다.
 *
 * ── 2026-09-15 실측(이 계측을 넣은 근거) ──────────────────────────────────
 * 로컬에서 OCI 프록시를 그대로 타고 잰 값이다(인증키 없이, 401이 돌아오는 probe).
 *   · 프록시로의 TCP 연결            186ms  정상
 *   · 인증된 CONNECT 8회 순차        60s+ · 60s+ · 60s+ · 6.7s · 11.5s · 1.4s · 0.6s · 0.6s
 *   · 터널이 선 뒤의 실제 API 왕복   290 ~ 1,700ms (GET · POST 차이 없음)
 * 즉 느린 것은 롯데ON이 아니라 **프록시의 CONNECT 핸드셰이크**이고, 20초 예산이
 * 롯데ON에 닿기도 전에 소진될 수 있다. 그래서 실패 응답에 `proxyProvider`를
 * 남긴다 — 어느 홉을 의심해야 하는지가 응답 자체에 적혀 있어야 한다.
 *
 * 🔴 값은 전부 시크릿이 아니다. 프록시 URL·사용자·비밀번호·인증키는 어디에도
 * 싣지 않는다(provider 라벨은 "OCI"/"FIXIE"/"NONE" 세 글자뿐이다).
 */
export interface LotteOnReadFailureContext {
  /** 어느 API에서 끊겼는가. 예: "207 identity(거래처 조회)". */
  step: string | null;
  /** 호출에 실제로 걸린 시간. 20,000ms 근처면 예산을 다 쓰고 죽은 것이다. */
  elapsedMs: number;
  /** 아웃바운드 홉 라벨. URL/자격증명은 포함하지 않는다. */
  proxyProvider: string;
}

/** 실패 한 건을 Vercel 함수 로그에 한 줄로 남긴다 — 비밀값 없음. */
function logLotteOnFailure(context: LotteOnReadFailureContext, reason: string, detail: string | null): void {
  console.warn(
    `[lotteon] 조회 실패 step=${context.step ?? "(미지정)"} reason=${reason} ` +
      `elapsedMs=${context.elapsedMs} proxy=${context.proxyProvider}` +
      (detail ? ` detail=${detail}` : ""),
  );
}

/** 자격증명 → 호출 → returnCode 검사까지 한 번에. 성공이면 data를, 아니면
 * 화면에 그대로 보여줄 수 있는 실패 응답을 돌려준다.
 *
 * `envelope`:
 *  - "RETURN_CODE"(기본) — openapi.lotteon.com. `{returnCode, message, data}`
 *    봉투를 쓰고 returnCode가 "0000"이어야 성공이다.
 *  - "RAW" — onpick-api.lotteon.com(카테고리/속성/브랜드). 문서 원문의 응답
 *    샘플이 `{ itemList: [...] }`이고 **returnCode 필드가 아예 없다** — 여기에
 *    returnCode 게이트를 걸면 정상 응답이 전부 실패로 잡힌다. 호스트마다
 *    응답 규약이 다르다는 사실을 숨기지 않고 호출부가 명시하게 한다.
 */
export async function runLotteOnRead(options: {
  host?: LotteOnHost;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  envelope?: "RETURN_CODE" | "RAW";
  /**
   * LOTTEON-TIMEOUT-1 — 이 호출의 이름(예: "150 출고지/반품지 조회").
   * 실패 응답과 서버 로그가 이 이름을 그대로 쓴다. 넘기지 않으면 `step`은
   * null이고, 그때는 화면이 "어느 단계인지 모른다"는 사실까지 그대로 본다 —
   * 그럴듯한 이름을 지어내지 않는다.
   */
  step?: string;
}): Promise<{ ok: true; result: LotteOnApiResponse } | { ok: false; response: NextResponse }> {
  const startedAt = Date.now();
  const step = options.step ?? null;
  const proxyProvider = getOutboundProxyDiagnostics().provider;
  /** 실패 응답마다 똑같이 붙는 꼬리표. 성공 응답에는 붙지 않는다. */
  const context = (): LotteOnReadFailureContext => ({
    step,
    elapsedMs: Date.now() - startedAt,
    proxyProvider,
  });

  const credentials = await getLotteOnCredentials();
  if (!credentials) {
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: "NOT_CONFIGURED",
        ...context(),
        message: "롯데ON 인증키가 설정되어 있지 않습니다 — 설정 > 커머스 계정 관리에서 인증키를 입력해 주세요.",
      }),
    };
  }

  const call = options.host === "onpick" ? callLotteOnPickApi : callLotteOnApi;
  let result: LotteOnApiResponse | LotteOnApiError;
  try {
    result = await call(credentials.apiKey, {
      method: options.method,
      path: options.path,
      query: options.query,
      body: options.body,
    });
  } catch (error) {
    // 🔴 금지 엔드포인트 guard가 던진 경우 — 라우트가 500으로 죽지 않게 잡되,
    // 절대 조용히 넘기지 않는다. 이 응답이 보이면 그것은 버그 리포트다.
    logLotteOnFailure(context(), "FORBIDDEN_ENDPOINT", options.path);
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: "FORBIDDEN_ENDPOINT",
        ...context(),
        message: error instanceof Error ? error.message : "허용되지 않은 롯데ON 엔드포인트 호출입니다.",
      }),
    };
  }

  if (!result.ok) {
    /* REWORK-12 ②(CEO 실측 캡처, 2026-09-15) — 여기서 `result.message`를 그대로
       내려보내던 것이 화면의 "The operation was aborted due to timeout"이었다.
       `AbortSignal.timeout()`이 던진 DOMException의 영문 message다.

       🔴 원문을 버리지 않는다 — `providerMessage`로 그대로 남는다(디버깅 경로).
       바뀌는 것은 화면이 읽는 `message` 하나이고, 위 HTTP/returnCode 분기가
       이미 쓰던 규칙(classify… → userMessage)과 같은 모양이 된다. */
    const issue = classifyLotteOnNetworkError(result.message);
    logLotteOnFailure(context(), "NETWORK_ERROR", result.message);
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: "NETWORK_ERROR",
        ...context(),
        ...issue,
        message: issue.userMessage,
        providerMessage: result.message,
        causeChain: result.causeChain,
      }),
    };
  }

  const httpIssue = classifyLotteOnHttpStatus(result.httpStatus);
  if (httpIssue) {
    logLotteOnFailure(context(), `HTTP_${result.httpStatus}`, null);
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: result.httpStatus === 403 ? "IP_NOT_ALLOWLISTED" : "HTTP_ERROR",
        httpStatus: result.httpStatus,
        ...context(),
        ...httpIssue,
        message: httpIssue.userMessage,
      }),
    };
  }

  if ((options.envelope ?? "RETURN_CODE") === "RETURN_CODE" && !result.returnOk) {
    const issue = classifyLotteOnReturnCode(result.returnCode, result.message);
    logLotteOnFailure(context(), `RETURN_CODE_${result.returnCode ?? "NONE"}`, null);
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: "RETURN_CODE_NOT_OK",
        returnCode: result.returnCode,
        ...context(),
        ...issue,
        message: issue.userMessage,
        lotteOnMessage: result.message,
      }),
    };
  }

  return { ok: true, result };
}

/** yyyyMMddHHmmss. 롯데ON은 전부 이 포맷이고 KST 기준이다. */
export function formatLotteOnDateTime(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}` +
    `${pad(kst.getUTCHours())}${pad(kst.getUTCMinutes())}${pad(kst.getUTCSeconds())}`
  );
}

/** 화면에서 넘어온 "YYYY-MM-DD" 를 검색 시작/종료 일시로 바꾼다. */
export function toSearchRange(dateYmd: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  const compact = dateYmd.replace(/-/g, "");
  return { start: `${compact}000000`, end: `${compact}235959` };
}
