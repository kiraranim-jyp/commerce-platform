import { signCoupangRequest } from "./signing";
import type { CoupangCredentials } from "./env";

const COUPANG_API_BASE = "https://api-gateway.coupang.com";

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
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json;charset=UTF-8",
      "X-Requested-By": credentials.vendorId,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let parsedBody: unknown = null;
  try {
    parsedBody = await res.json();
  } catch {
    parsedBody = null;
  }
  return { status: res.status, ok: res.ok, body: parsedBody };
}
