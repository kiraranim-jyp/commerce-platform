/**
 * P-14-1(CPO 지시, 2026-09-01) — page.evaluate() 등 Playwright 쪽 대기에는
 * 자체 timeout 옵션이 없어서, autoScroll()의 scrollHeight 폴링처럼 조건이 영원히
 * 안 맞으면 universalExtract() 전체가 무한 대기한다. 이 순수 함수 하나로 어떤
 * Promise든 지정한 시간 안에 못 끝나면 명확한 에러로 실패 처리한다.
 */

export class ExtractionTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "ExtractionTimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ExtractionTimeoutError(label, timeoutMs)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
