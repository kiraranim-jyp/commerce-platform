import { NextResponse } from "next/server";
import { getLotteOnCredentials } from "./env";
import { callLotteOnApi, callLotteOnPickApi, type LotteOnApiError, type LotteOnApiResponse } from "./client";
import { classifyLotteOnHttpStatus, classifyLotteOnReturnCode } from "./connection-error";

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
}): Promise<{ ok: true; result: LotteOnApiResponse } | { ok: false; response: NextResponse }> {
  const credentials = await getLotteOnCredentials();
  if (!credentials) {
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: "NOT_CONFIGURED",
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
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: "FORBIDDEN_ENDPOINT",
        message: error instanceof Error ? error.message : "허용되지 않은 롯데ON 엔드포인트 호출입니다.",
      }),
    };
  }

  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: "NETWORK_ERROR",
        message: result.message,
        causeChain: result.causeChain,
      }),
    };
  }

  const httpIssue = classifyLotteOnHttpStatus(result.httpStatus);
  if (httpIssue) {
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: result.httpStatus === 403 ? "IP_NOT_ALLOWLISTED" : "HTTP_ERROR",
        httpStatus: result.httpStatus,
        ...httpIssue,
        message: httpIssue.userMessage,
      }),
    };
  }

  if ((options.envelope ?? "RETURN_CODE") === "RETURN_CODE" && !result.returnOk) {
    const issue = classifyLotteOnReturnCode(result.returnCode, result.message);
    return {
      ok: false,
      response: NextResponse.json({
        ok: false,
        reason: "RETURN_CODE_NOT_OK",
        returnCode: result.returnCode,
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
