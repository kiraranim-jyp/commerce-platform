/**
 * Sprint N-1.2 — production 호출 전에 반드시 통과해야 하는 순수 서명 테스트.
 * 네이버 공식 인증 문서(apicenter.commerce.naver.com/docs/auth) Node.js 예제의
 * 샘플 입력값/출력값을 그대로 사용한다 — 실제 시크릿이 아니라 문서에 공개된
 * 고정 예제 값이라 로그에 남겨도 안전하다.
 *
 * 사용법: npx tsx apps/admin/scripts/verify-naver-signature.ts
 */
import { buildClientSecretSign } from "../src/app/api/naver/_lib/client";

const SAMPLE_CLIENT_ID = "aaaabbbbcccc";
const SAMPLE_CLIENT_SECRET = "$2a$10$abcdefghijklmnopqrstuv";
const SAMPLE_TIMESTAMP = 1643961623299;
const EXPECTED_SIGNATURE = "JDJhJDEwJGFiY2RlZmdoaWprbG1ub3BxcnN0dVVCVldZSk42T0VPdEx1OFY0cDQxa2IuTnpVaUEzbmsy";

const actual = buildClientSecretSign(SAMPLE_CLIENT_ID, SAMPLE_CLIENT_SECRET, SAMPLE_TIMESTAMP);

console.log("actual  :", actual);
console.log("expected:", EXPECTED_SIGNATURE);

if (actual === EXPECTED_SIGNATURE) {
  console.log("\nPASS — 공식 샘플과 정확히 일치");
  process.exit(0);
} else {
  console.log("\nFAIL — 공식 샘플과 불일치. production 호출 금지(work order 지시).");
  process.exit(1);
}
