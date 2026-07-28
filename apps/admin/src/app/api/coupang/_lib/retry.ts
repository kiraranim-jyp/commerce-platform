/**
 * 일시적 오류(네트워크/타임아웃/429/5xx)만 자동 재시도한다 — 데이터 누락처럼
 * 사용자가 고쳐야 하는 원인은 재시도해도 똑같이 실패하므로 이 헬퍼로 감싸면 안 된다.
 * 지수 백오프, 최대 3회(최초 시도 포함 총 3번 호출)까지 시도한다.
 */
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

/**
 * fn()이 던지거나(네트워크 예외) shouldRetry(value)가 true를 반환하는 동안(예: 429
 * 응답을 정상 값으로 받는 callCoupangApi류) 재시도한다. 마지막 시도에서 예외가
 * 나면 그대로 던지고, 마지막 시도의 결과값이 shouldRetry 조건에 걸려도 그 값을
 * 그대로 반환한다(더 이상 재시도할 여지가 없으므로 호출부가 실패로 해석해서 처리).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (value: T) => boolean,
): Promise<RetryResult<T>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const value = await fn();
      if (!shouldRetry(value) || attempt === MAX_ATTEMPTS) {
        return { value, attempts: attempt };
      }
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) throw error;
    }
    const waitMs = Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_CAP_MS);
    await sleep(waitMs);
  }
  // 이 지점에 도달하면 마지막 시도가 예외를 던진 것이므로 위에서 이미 throw했다 —
  // TypeScript 흐름 분석을 만족시키기 위한 안전망일 뿐 실제로는 도달하지 않는다.
  throw lastError instanceof Error ? lastError : new Error("재시도에 실패했습니다.");
}
