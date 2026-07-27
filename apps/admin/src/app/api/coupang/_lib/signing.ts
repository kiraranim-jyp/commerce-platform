import crypto from "node:crypto";

/**
 * 쿠팡 Wing Open API 인증 방식("CEA" HMAC-SHA256) — developers.coupang.com
 * 공식 문서(2026-07 확인)로 검증한 알고리즘 그대로 구현한다.
 *
 * message = signedDate + method + path + query (구분자 없이 그대로 이어붙인다)
 * signedDate 형식: yyMMddTHHmmssZ (UTC 기준)
 * Authorization 헤더: "CEA algorithm=HmacSHA256, access-key=..., signed-date=..., signature=..."
 */
function formatSignedDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yy = pad(date.getUTCFullYear() % 100);
  const MM = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const HH = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${yy}${MM}${dd}T${HH}${mm}${ss}Z`;
}

export function signCoupangRequest({
  method,
  path,
  query = "",
  accessKey,
  secretKey,
}: {
  method: string;
  path: string;
  query?: string;
  accessKey: string;
  secretKey: string;
}): { authorization: string; signedDate: string } {
  const signedDate = formatSignedDate(new Date());
  const message = `${signedDate}${method.toUpperCase()}${path}${query}`;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
  return { authorization, signedDate };
}
